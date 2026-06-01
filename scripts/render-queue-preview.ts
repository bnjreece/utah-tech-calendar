import { fetchQueueSnapshot, buildQueueDigestEmail } from "@/lib/queue-digest";
import { writeFileSync } from "fs";
const snap = await fetchQueueSnapshot();
const out = buildQueueDigestEmail(snap);
writeFileSync("/tmp/queue-digest-preview.html", out.html);
writeFileSync("/tmp/queue-digest-preview.txt", out.text);
console.log("subject:", out.subject);
console.log("events:", snap.pendingEvents.length, "submissions:", snap.pendingSubmissions.length);
