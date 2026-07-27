const SOURCE_URL = "https://iptv36.vercel.app/v2.m3u";

// ช่องที่ต้องการให้แสดงใน Playlist ของคุณ
const ALLOWED_CHANNELS = [
  "NBT FHD",
  "Thai PBS FHD",
  "T-Sports",
  "CH7 FHD",
  "CH3 HD",
  "ONE FHD",
  "GMM25 FHD",
  "Workpoint TV",
  "True4U HD",
  "Thairath TV FHD"
];

function getChannelName(extinf) {
  const comma = extinf.indexOf(",");
  return comma >= 0 ? extinf.slice(comma + 1).trim() : "";
}

function getAttribute(line, name) {
  const regex = new RegExp(`${name}="([^"]*)"`);
  const match = line.match(regex);
  return match ? match[1] : "";
}

function getGroup(name) {
  const n = name.toLowerCase();

  if (n.includes("sports") || n.includes("t-sports")) {
    return "กีฬา";
  }

  if (
    n.includes("nbt") ||
    n.includes("thai pbs") ||
    n.includes("nation") ||
    n.includes("thairath") ||
    n.includes("mcot") ||
    n.includes("tnn")
  ) {
    return "ข่าว";
  }

  return "บันเทิง";
}

function parsePlaylist(text) {
  const lines = text.split(/\r?\n/);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line.startsWith("#EXTINF:")) {
      continue;
    }

    const extinf = line;
    const extras = [];
    let j = i + 1;

    while (
      j < lines.length &&
      lines[j].trim().startsWith("#EXTVLCOPT:")
    ) {
      extras.push(lines[j].trim());
      j++;
    }

    if (
      j < lines.length &&
      lines[j].trim() &&
      !lines[j].trim().startsWith("#")
    ) {
      result.push({
        extinf,
        extras,
        url: lines[j].trim()
      });

      i = j;
    }
  }

  return result;
}

export default async function handler(req, res) {
  try {
    const response = await fetch(SOURCE_URL);

    if (!response.ok) {
      throw new Error(`Source playlist returned HTTP ${response.status}`);
    }

    const sourceText = await response.text();
    const channels = parsePlaylist(sourceText);

    const selected = channels.filter((channel) => {
      const name = getChannelName(channel.extinf);
      return ALLOWED_CHANNELS.includes(name);
    });

    let output = "#EXTM3U\n\n";

    selected.forEach((channel, index) => {
      const name = getChannelName(channel.extinf);
      const logo = getAttribute(channel.extinf, "tvg-logo");
      const tvgId = getAttribute(channel.extinf, "tvg-id");

      const attributes = [
        `tvg-chno="${index + 1}"`,
        tvgId ? `tvg-id="${tvgId}"` : "",
        `group-title="${getGroup(name)}"`,
        logo ? `tvg-logo="${logo}"` : ""
      ]
        .filter(Boolean)
        .join(" ");

      output += `#EXTINF:-1 ${attributes},${name}\n`;

      if (channel.extras.length > 0) {
        output += channel.extras.join("\n") + "\n";
      }

      output += `${channel.url}\n\n`;
    });

    res.setHeader("Content-Type", "application/x-mpegURL; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=60"
    );

    res.status(200).send(output);
  } catch (error) {
    res.status(500).send(`#EXTM3U\n\n#ERROR\n${error.message}`);
  }
}
