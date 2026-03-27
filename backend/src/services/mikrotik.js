import net from "node:net";

// RouterOS API sentence encoder/decoder
const encodeWord = (word) => {
  const buf = Buffer.from(word, "utf-8");
  const len = buf.length;
  const prefix = [];

  if (len < 0x80) {
    prefix.push(len);
  } else if (len < 0x4000) {
    prefix.push(((len >> 8) | 0x80), len & 0xff);
  } else if (len < 0x200000) {
    prefix.push(((len >> 16) | 0xc0), (len >> 8) & 0xff, len & 0xff);
  } else {
    prefix.push(0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
  }

  return Buffer.concat([Buffer.from(prefix), buf]);
};

const encodeSentence = (words) =>
  Buffer.concat([...words.map(encodeWord), Buffer.from([0x00])]);

const decodeLength = (buf, offset) => {
  const b = buf[offset];
  if (b < 0x80) return { len: b, bytesRead: 1 };
  if (b < 0xc0) return { len: ((b & 0x3f) << 8) | buf[offset + 1], bytesRead: 2 };
  if (b < 0xe0) return { len: ((b & 0x1f) << 16) | (buf[offset + 1] << 8) | buf[offset + 2], bytesRead: 3 };
  return { len: (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3], bytesRead: 4 };
};

const parseSentences = (buf) => {
  const sentences = [];
  let current = [];
  let i = 0;

  while (i < buf.length) {
    if (buf[i] === 0x00) {
      sentences.push(current);
      current = [];
      i++;
      continue;
    }
    const { len, bytesRead } = decodeLength(buf, i);
    i += bytesRead;
    current.push(buf.slice(i, i + len).toString("utf-8"));
    i += len;
  }

  return sentences;
};

// Low-level RouterOS API session
const routerOsSession = (host, port, timeoutMs) =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error("RouterOS connection timeout"));
      }
    }, timeoutMs);

    socket.on("connect", () => {
      clearTimeout(timer);
      settled = true;
      resolve({
        send: (words) => socket.write(encodeSentence(words)),
        onData: (cb) => socket.on("data", (chunk) => { chunks.push(chunk); cb(parseSentences(Buffer.concat(chunks))); }),
        close: () => socket.destroy(),
      });
    });

    socket.on("error", (err) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(err); }
    });
  });

// Send a command and collect all reply sentences until !done or !trap
const runCommand = (session, words) =>
  new Promise((resolve, reject) => {
    const replies = [];
    session.onData((sentences) => {
      for (const sentence of sentences) {
        if (!sentence.length) continue;
        const tag = sentence[0];
        const attrs = Object.fromEntries(
          sentence.slice(1)
            .filter((w) => w.startsWith("="))
            .map((w) => { const eq = w.indexOf("=", 1); return [w.slice(1, eq), w.slice(eq + 1)]; })
        );
        if (tag === "!done") { resolve(replies); return; }
        if (tag === "!trap") { reject(new Error(attrs.message || "RouterOS error")); return; }
        if (tag === "!re") replies.push(attrs);
      }
    });
    session.send(words);
  });

// Public API

export const addHotspotUser = async ({ host, port = 8728, username, password, profile, timeoutMs = 5000 }) => {
  const session = await routerOsSession(host, port, timeoutMs);
  try {
    // Login (plain-text for API — RouterOS API v1 uses MD5 challenge but plain works on most setups)
    await runCommand(session, ["/login", `=name=${username}`, `=password=${password}`]);

    // Add hotspot user — name = MAC address, profile = plan name
    await runCommand(session, [
      "/ip/hotspot/user/add",
      `=name=${username}`,
      `=profile=${profile}`,
      `=comment=BillIT-auto`,
    ]);
  } finally {
    session.close();
  }
};

export const removeHotspotUser = async ({ host, port = 8728, username, password, hotspotUsername, timeoutMs = 5000 }) => {
  const session = await routerOsSession(host, port, timeoutMs);
  try {
    await runCommand(session, ["/login", `=name=${username}`, `=password=${password}`]);
    const users = await runCommand(session, ["/ip/hotspot/user/print", `?name=${hotspotUsername}`]);
    if (users.length > 0 && users[0][".id"]) {
      await runCommand(session, ["/ip/hotspot/user/remove", `=.id=${users[0][".id"]}`]);
    }
  } finally {
    session.close();
  }
};
