import client from "./bullmqRedis.js";
import { Queue } from "bullmq";

export const tournamentQueue = new Queue("tournamentQueue", {
  connection: client,
});