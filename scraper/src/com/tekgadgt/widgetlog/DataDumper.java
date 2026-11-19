package com.tekgadgt.widgetlog;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import net.runelite.api.Client;
import net.runelite.api.EnumComposition;
import net.runelite.api.IntegerNode;
import net.runelite.api.ItemComposition;
import net.runelite.api.Node;
import net.runelite.client.game.ItemEquipmentStats;
import net.runelite.client.game.ItemManager;
import net.runelite.client.game.ItemStats;

/**
 * Reads the game data tables (DB tables) and enums the client already holds in its cache.
 * Read-only: nothing is sent to the server. Runs a slice per call so the client doesn't freeze.
 */
class DataDumper
{
	// August's affix and power tables sit around 9900-10000.
	private static final int MAX_TABLE = 16384;
	private static final int MAX_ENUM = 20000;
	/** DB rows have no column list in the API, so columns are probed up to this many. */
	private static final int MAX_COLUMN = 64;
	private static final int MAX_TUPLES = 512;
	private static final int TABLES_PER_SLICE = 256;
	private static final int ENUMS_PER_SLICE = 1000;

	private final Client client;
	private final ItemManager itemManager;
	private final Gson gson = new GsonBuilder().disableHtmlEscaping().create();
	private final BiConsumer<String, String> save;
	private final Consumer<String> log;

	/** Item ids seen in column 0 of the gear item tables, named once the tables are done. */
	private static final java.util.Set<Integer> ITEM_TABLES = java.util.Set.of(9928, 9932);
	private final java.util.SortedSet<Integer> itemIds = new java.util.TreeSet<>();
	private boolean itemsDone;

	private int nextTable;
	private int nextEnum;
	private int tables;
	private int enums;

	DataDumper(Client client, ItemManager itemManager, BiConsumer<String, String> save, Consumer<String> log)
	{
		this.client = client;
		this.itemManager = itemManager;
		this.save = save;
		this.log = log;
	}

	/** Dumps the next slice. Returns true when everything is done. Call on the client thread. */
	boolean step()
	{
		if (nextTable < MAX_TABLE)
		{
			int end = Math.min(MAX_TABLE, nextTable + TABLES_PER_SLICE);
			for (; nextTable < end; nextTable++)
			{
				dumpTable(nextTable);
			}
			return false;
		}
		if (nextEnum < MAX_ENUM)
		{
			int end = Math.min(MAX_ENUM, nextEnum + ENUMS_PER_SLICE);
			JsonObject slice = new JsonObject();
			for (; nextEnum < end; nextEnum++)
			{
				JsonObject e = describeEnum(nextEnum);
				if (e != null)
				{
					slice.add(String.valueOf(nextEnum), e);
					enums++;
				}
			}
			if (slice.size() > 0)
			{
				save.accept("data/enums-" + (end - ENUMS_PER_SLICE) + ".json", gson.toJson(slice));
			}
			return false;
		}
		if (!itemsDone)
		{
			dumpItemNames();
			itemsDone = true;
			return false;
		}
		log.accept("game data dump done: " + tables + " tables, " + enums + " enums with values, " + itemIds.size() + " item names");
		return true;
	}

	private void dumpTable(int table)
	{
		List<Integer> rows;
		try
		{
			rows = client.getDBTableRows(table);
		}
		catch (RuntimeException ex)
		{
			return;
		}
		if (rows == null || rows.isEmpty())
		{
			return;
		}
		JsonArray out = new JsonArray();
		for (int row : rows)
		{
			JsonObject r = new JsonObject();
			r.addProperty("row", row);
			for (int col = 0; col < MAX_COLUMN; col++)
			{
				JsonArray tuples = new JsonArray();
				for (int t = 0; t < MAX_TUPLES; t++)
				{
					Object[] value;
					try
					{
						value = client.getDBTableField(row, col, t);
					}
					catch (RuntimeException ex)
					{
						break;
					}
					if (value == null || value.length == 0)
					{
						break;
					}
					JsonArray v = new JsonArray();
					for (Object o : value)
					{
						v.add(o instanceof Number ? new JsonPrimitive((Number) o) : new JsonPrimitive(String.valueOf(o)));
					}
					tuples.add(v);
				}
				if (tuples.size() > 0)
				{
					r.add(String.valueOf(col), tuples);
				}
			}
			out.add(r);
		}
		tables++;
		save.accept("data/table-" + table + ".json", gson.toJson(out));
		if (ITEM_TABLES.contains(table))
		{
			for (int row : rows)
			{
				try
				{
					Object[] id = client.getDBTableField(row, 0, 0);
					if (id != null && id.length > 0 && id[0] instanceof Integer)
					{
						itemIds.add((Integer) id[0]);
					}
				}
				catch (RuntimeException ex)
				{
					// not an item row
				}
			}
		}
	}

	/**
	 * Names, equipment slots, params, and equipment stats for the gear tables' items. The tables only
	 * hold item ids, and only some of them carry a slot.
	 */
	private void dumpItemNames()
	{
		JsonObject names = new JsonObject();
		JsonObject items = new JsonObject();
		for (int id : itemIds)
		{
			JsonObject o = new JsonObject();
			try
			{
				ItemComposition c = client.getItemDefinition(id);
				names.addProperty(String.valueOf(id), c.getName());
				o.addProperty("name", c.getName());
				o.addProperty("slot", c.getEquipmentSlot());
				o.addProperty("slot2", c.getEquipmentSlot2());
				o.add("actions", gson.toJsonTree(c.getInventoryActions()));
				JsonObject params = new JsonObject();
				if (c.getParams() != null)
				{
					for (Node n : c.getParams())
					{
						int key = (int) n.getHash();
						if (n instanceof IntegerNode)
						{
							params.addProperty(String.valueOf(key), ((IntegerNode) n).getValue());
						}
						else
						{
							params.addProperty(String.valueOf(key), c.getStringValue(key));
						}
					}
				}
				o.add("params", params);
			}
			catch (RuntimeException ex)
			{
				names.addProperty(String.valueOf(id), "");
				o.addProperty("error", String.valueOf(ex));
			}
			try
			{
				ItemStats stats = itemManager.getItemStats(id);
				ItemEquipmentStats eq = stats == null ? null : stats.getEquipment();
				if (eq != null)
				{
					o.add("stats", gson.toJsonTree(eq));
				}
			}
			catch (RuntimeException ex)
			{
				o.addProperty("statsError", String.valueOf(ex));
			}
			items.add(String.valueOf(id), o);
		}
		save.accept("data/item-names.json", gson.toJson(names));
		save.accept("data/items.json", gson.toJson(items));
	}

	private JsonObject describeEnum(int id)
	{
		EnumComposition e;
		try
		{
			e = client.getEnum(id);
		}
		catch (RuntimeException ex)
		{
			return null;
		}
		if (e == null || e.size() == 0)
		{
			return null;
		}
		JsonObject o = new JsonObject();
		o.add("keys", gson.toJsonTree(e.getKeys()));
		String[] strings = e.getStringVals();
		if (strings != null && strings.length > 0)
		{
			o.add("strings", gson.toJsonTree(strings));
		}
		else
		{
			o.add("ints", gson.toJsonTree(e.getIntVals()));
		}
		return o;
	}
}
