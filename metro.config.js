const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
// site/ is the Next.js marketing site, with its own node_modules (and its own
// React): keep Metro from crawling it.
const siteDir = path.join(__dirname, "site").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
config.resolver.blockList = [config.resolver.blockList, new RegExp(`^${siteDir}[\\/].*`)].flat().filter(Boolean);

module.exports = withNativeWind(config, { input: "./global.css" });
