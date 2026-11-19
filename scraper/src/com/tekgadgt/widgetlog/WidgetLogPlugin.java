package com.tekgadgt.widgetlog;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.inject.Inject;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.SwingUtilities;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.TreeMap;
import net.runelite.api.Client;
import net.runelite.api.ScriptEvent;
import net.runelite.api.GameState;
import net.runelite.api.ChatMessageType;
import net.runelite.api.events.ChatMessage;
import net.runelite.api.events.GameStateChanged;
import net.runelite.api.events.GameTick;
import net.runelite.api.events.ScriptPreFired;
import net.runelite.api.events.WidgetClosed;
import net.runelite.api.events.WidgetLoaded;
import net.runelite.api.widgets.Widget;
import net.runelite.client.callback.ClientThread;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.game.ItemManager;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import net.runelite.client.ui.ClientToolbar;
import net.runelite.client.ui.NavigationButton;
import net.runelite.client.ui.PluginPanel;

/**
 * Read-only: logs which interfaces open and close, and writes the widget tree of
 * each open interface to JSON whenever its contents change. It never clicks,
 * types, or sends anything to the server.
 */
@PluginDescriptor(name = "Widget Log", description = "Logs opened interfaces and dumps their widgets to JSON")
public class WidgetLogPlugin extends Plugin
{
	private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");
	private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss");
	/** Resizable and fixed top-level frames: they nest every other interface, so they are never dumped whole. */
	private static final Set<Integer> TOPLEVEL = Set.of(161, 164, 165, 548);
	/** Messages from the game itself, such as "Get-points-info" output. Player chat is never logged. */
	private static final Set<ChatMessageType> GAME_CHAT = Set.of(ChatMessageType.GAMEMESSAGE, ChatMessageType.SPAM,
		ChatMessageType.ENGINE, ChatMessageType.CONSOLE, ChatMessageType.MESBOX, ChatMessageType.BROADCAST, ChatMessageType.WELCOME);
	/** Interfaces loaded this soon after login are the standard HUD, not menus the player opened. */
	private static final int LOGIN_TICKS = 3;

	@Inject
	private Client client;

	@Inject
	private ClientThread clientThread;

	@Inject
	private ItemManager itemManager;

	@Inject
	private ClientToolbar clientToolbar;

	private final Gson gson = new GsonBuilder().disableHtmlEscaping().setPrettyPrinting().create();
	private final ExecutorService writer = Executors.newSingleThreadExecutor();
	/** Interfaces opened since login, in open order. */
	private final Set<Integer> open = new LinkedHashSet<>();
	/** Last dumped content per interface, so unchanged ticks write nothing. */
	private final Map<Integer, Integer> lastHash = new HashMap<>();
	private final Map<Integer, String> itemNames = new HashMap<>();

	private Path out;
	private NavigationButton button;
	private JLabel status;
	private int dumps;
	private int ticksLoggedIn;
	/** Scripts that ran since the last dump while a tracked interface was open, by id. */
	private final Map<Integer, Integer> scriptCounts = new TreeMap<>();
	/** Scripts a tracked interface's own widgets triggered (typing, clicks), with their arguments. */
	private final List<String> scriptCalls = new ArrayList<>();
	private DataDumper dataDumper;

	@Override
	protected void startUp() throws IOException
	{
		out = Paths.get(System.getProperty("widgetlog.dir", System.getProperty("user.home") + "/widget-log"));
		Files.createDirectories(out.resolve("dumps"));
		log("started, writing to " + out.toAbsolutePath());
		SwingUtilities.invokeLater(this::addPanel);
	}

	@Override
	protected void shutDown()
	{
		clientToolbar.removeNavigation(button);
		writer.shutdown();
	}

	@Subscribe
	public void onGameStateChanged(GameStateChanged e)
	{
		if (e.getGameState() != GameState.LOGGED_IN)
		{
			ticksLoggedIn = 0;
			open.clear();
			lastHash.clear();
		}
	}

	@Subscribe
	public void onWidgetLoaded(WidgetLoaded e)
	{
		int group = e.getGroupId();
		if (TOPLEVEL.contains(group) || ticksLoggedIn < LOGIN_TICKS)
		{
			log("loaded " + group + " (login or frame, not auto-dumped)");
			return;
		}
		if (open.add(group))
		{
			log("opened " + group);
		}
		// Contents fill in over the next few scripts; the tick check dumps them once they settle.
		lastHash.remove(group);
	}

	@Subscribe
	public void onChatMessage(ChatMessage e)
	{
		if (GAME_CHAT.contains(e.getType()))
		{
			log("chat " + e.getType() + ": " + e.getMessage(), false);
		}
	}

	@Subscribe
	public void onScriptPreFired(ScriptPreFired e)
	{
		if (open.isEmpty())
		{
			return;
		}
		scriptCounts.merge(e.getScriptId(), 1, Integer::sum);
		ScriptEvent ev = e.getScriptEvent();
		Widget source = ev == null ? null : ev.getSource();
		if (source != null && open.contains(source.getId() >>> 16) && scriptCalls.size() < 100)
		{
			scriptCalls.add("script " + e.getScriptId() + " from " + (source.getId() >>> 16) + ":" + (source.getId() & 0xffff)
				+ " args " + Arrays.deepToString(ev.getArguments()));
		}
	}

	@Subscribe
	public void onWidgetClosed(WidgetClosed e)
	{
		int group = e.getGroupId();
		if (open.remove(group))
		{
			log("closed " + group);
		}
		lastHash.remove(group);
	}

	@Subscribe
	public void onGameTick(GameTick e)
	{
		if (client.getGameState() != GameState.LOGGED_IN)
		{
			return;
		}
		ticksLoggedIn++;
		for (int group : open)
		{
			dumpIfChanged(group, "change");
		}
	}

	/** Dumps every interface on screen, including ones open since login (sidebars, the League panel). */
	private void dumpEverything()
	{
		clientThread.invoke(() ->
		{
			Set<Integer> groups = new LinkedHashSet<>();
			for (Widget root : client.getWidgetRoots())
			{
				collectGroups(root, groups);
			}
			lastHash.clear();
			groups.removeAll(TOPLEVEL);
			for (int group : groups)
			{
				dumpIfChanged(group, "manual");
			}
			log("manual dump of " + groups.size() + " interfaces");
		});
	}

	/** Reads the client's cached data tables and enums, a slice per client tick. */
	private void dumpGameData()
	{
		if (dataDumper != null)
		{
			log("game data dump already running");
			return;
		}
		log("game data dump started");
		dataDumper = new DataDumper(client, itemManager, (file, json) -> writer.submit(() -> save(file, json)), this::log);
		clientThread.invokeLater(() ->
		{
			boolean done = dataDumper.step();
			if (done)
			{
				dataDumper = null;
			}
			return done;
		});
	}

	private void save(String file, String json)
	{
		Path path = out.resolve(file);
		try
		{
			Files.createDirectories(path.getParent());
		}
		catch (IOException ex)
		{
			ex.printStackTrace();
		}
		write(path, json, false);
	}

	private void collectGroups(Widget w, Set<Integer> groups)
	{
		if (w == null || w.isHidden())
		{
			return;
		}
		groups.add(w.getId() >>> 16);
		for (Widget[] children : new Widget[][]{w.getStaticChildren(), w.getDynamicChildren(), w.getNestedChildren()})
		{
			if (children != null)
			{
				for (Widget c : children)
				{
					collectGroups(c, groups);
				}
			}
		}
	}

	private void dumpIfChanged(int group, String reason)
	{
		JsonArray roots = new JsonArray();
		// A group's top-level components are child ids 0..n with no parent inside the group.
		for (int child = 0; child < 2048; child++)
		{
			Widget w = client.getWidget(group, child);
			if (w == null)
			{
				if (child > 0 && client.getWidget(group, child + 1) == null && client.getWidget(group, child + 2) == null)
				{
					break;
				}
				continue;
			}
			if (w.getParentId() == -1 || (w.getParentId() >>> 16) != group)
			{
				roots.add(describe(w));
			}
		}
		if (roots.size() == 0)
		{
			return;
		}
		int hash = roots.toString().hashCode();
		Integer previous = lastHash.put(group, hash);
		if (previous != null && previous == hash)
		{
			return;
		}

		JsonObject dump = new JsonObject();
		dump.addProperty("group", group);
		dump.addProperty("reason", reason);
		dump.addProperty("time", LocalDateTime.now().toString());
		dump.addProperty("title", title(roots));
		dump.add("scripts", gson.toJsonTree(scriptCounts));
		dump.add("scriptCalls", gson.toJsonTree(scriptCalls));
		dump.add("widgets", roots);
		String name = STAMP.format(LocalDateTime.now()) + "_g" + group + ".json";
		String json = gson.toJson(dump);
		dumps++;
		log("dumped " + group + " (" + reason + ") " + name + " \"" + title(roots) + "\"");
		for (String call : scriptCalls)
		{
			log("  " + call);
		}
		scriptCounts.clear();
		scriptCalls.clear();
		writer.submit(() -> write(out.resolve("dumps").resolve(name), json, false));
	}

	private JsonObject describe(Widget w)
	{
		JsonObject o = new JsonObject();
		o.addProperty("id", (w.getId() >>> 16) + ":" + (w.getId() & 0xffff));
		if (w.getIndex() >= 0)
		{
			o.addProperty("index", w.getIndex());
		}
		o.addProperty("type", w.getType());
		if (w.isSelfHidden())
		{
			o.addProperty("hidden", true);
		}
		addText(o, "text", w.getText());
		addText(o, "name", w.getName());
		String[] actions = w.getActions();
		if (actions != null)
		{
			JsonArray a = new JsonArray();
			for (String action : actions)
			{
				if (action != null && !action.isEmpty())
				{
					a.add(action);
				}
			}
			if (a.size() > 0)
			{
				o.add("actions", a);
			}
		}
		if (w.getItemId() > 0)
		{
			o.addProperty("itemId", w.getItemId());
			o.addProperty("item", itemName(w.getItemId()));
			o.addProperty("qty", w.getItemQuantity());
		}
		if (w.getSpriteId() > 0)
		{
			o.addProperty("sprite", w.getSpriteId());
		}
		if (w.getModelId() > 0)
		{
			o.addProperty("model", w.getModelId());
		}
		Rectangle b = w.getBounds();
		if (b != null)
		{
			o.addProperty("bounds", b.x + "," + b.y + "," + b.width + "," + b.height);
		}
		if (w.getScrollHeight() > 0)
		{
			o.addProperty("scrollHeight", w.getScrollHeight());
		}

		JsonArray kids = new JsonArray();
		for (Widget[] children : new Widget[][]{w.getStaticChildren(), w.getDynamicChildren(), w.getNestedChildren()})
		{
			if (children != null)
			{
				for (Widget c : children)
				{
					if (c != null)
					{
						kids.add(describe(c));
					}
				}
			}
		}
		if (kids.size() > 0)
		{
			o.add("children", kids);
		}
		return o;
	}

	private static void addText(JsonObject o, String key, String value)
	{
		if (value != null && !value.isEmpty())
		{
			o.addProperty(key, value);
		}
	}

	private String itemName(int id)
	{
		return itemNames.computeIfAbsent(id, i -> itemManager.getItemComposition(i).getName());
	}

	/** The first few texts in a dump, to tell interfaces apart in the log. */
	private static String title(JsonArray roots)
	{
		StringBuilder sb = new StringBuilder();
		collectText(roots, sb);
		String t = sb.toString().replaceAll("<[^>]*>", "").trim();
		return t.length() > 80 ? t.substring(0, 80) : t;
	}

	private static void collectText(JsonArray nodes, StringBuilder sb)
	{
		for (int i = 0; i < nodes.size() && sb.length() < 100; i++)
		{
			JsonObject n = nodes.get(i).getAsJsonObject();
			if (n.has("text"))
			{
				sb.append(n.get("text").getAsString()).append(" | ");
			}
			if (n.has("children"))
			{
				collectText(n.getAsJsonArray("children"), sb);
			}
		}
	}

	private void log(String line)
	{
		log(line, true);
	}

	/** Chat goes to the log file only, so the panel keeps showing the plugin's own activity. */
	private void log(String line, boolean showInPanel)
	{
		String entry = TIME.format(LocalDateTime.now()) + " " + line;
		writer.submit(() -> write(out.resolve("menus.log"), entry + "\n", true));
		if (showInPanel && status != null)
		{
			SwingUtilities.invokeLater(() -> status.setText("<html>" + dumps + " dumps<br>" + line.replace("<", "&lt;") + "</html>"));
		}
	}

	private static void write(Path file, String text, boolean append)
	{
		try
		{
			Files.write(file, text.getBytes(StandardCharsets.UTF_8),
				StandardOpenOption.CREATE, append ? StandardOpenOption.APPEND : StandardOpenOption.TRUNCATE_EXISTING);
		}
		catch (IOException ex)
		{
			ex.printStackTrace();
		}
	}

	private void addPanel()
	{
		PluginPanel panel = new PluginPanel() {};
		panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
		panel.add(new JLabel("<html><b>Widget Log</b><br>Open menus normally. Each change is saved to:<br>" + out.toAbsolutePath() + "</html>"));
		JButton all = new JButton("Dump everything on screen");
		all.addActionListener(ev -> dumpEverything());
		panel.add(all);
		JButton data = new JButton("Dump game data (tables, enums)");
		data.addActionListener(ev -> dumpGameData());
		panel.add(data);
		status = new JLabel("Waiting for an interface to open");
		panel.add(status);

		BufferedImage icon = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = icon.createGraphics();
		g.setColor(new Color(0xff7a1a));
		g.fillRect(2, 2, 12, 12);
		g.setColor(Color.BLACK);
		g.drawString("W", 3, 13);
		g.dispose();

		button = NavigationButton.builder().tooltip("Widget Log").icon(icon).priority(99).panel(panel).build();
		clientToolbar.addNavigation(button);
	}
}
