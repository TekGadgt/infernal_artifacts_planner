package com.tekgadgt.widgetlog;

import net.runelite.client.RuneLite;
import net.runelite.client.externalplugins.ExternalPluginManager;

/** Starts the August client with the Widget Log plugin loaded, the way RuneLite's plugin template runs plugins. */
public class Launch
{
	public static void main(String[] args) throws Exception
	{
		ExternalPluginManager.loadBuiltin(WidgetLogPlugin.class);
		RuneLite.main(args);
	}
}
