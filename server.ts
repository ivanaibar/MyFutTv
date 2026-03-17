import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { initLiveUpdater } from "./src/services/liveUpdater";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
    },
  });

  initLiveUpdater(io);

  httpServer.listen(port, () => {
    console.log(`> MyFutTV ready on http://${hostname}:${port}`);
  });
});
