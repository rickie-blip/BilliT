import net from "node:net";

export const testRouterTcpConnection = ({ host, port = 8728, timeoutMs = 3000 }) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (result) => {
      if (done) {
        return;
      }
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      finish({ ok: true, message: "Connection successful" });
    });

    socket.once("timeout", () => {
      finish({ ok: false, message: "Connection timeout" });
    });

    socket.once("error", (error) => {
      finish({ ok: false, message: error.message || "Connection failed" });
    });

    socket.connect(port, host);
  });
