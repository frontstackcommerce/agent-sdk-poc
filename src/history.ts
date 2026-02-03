import fs from "node:fs";
import rl from "readline";

export async function* fetchMessages(transcriptPath: string) {
    if (transcriptPath === "" || !fs.existsSync(transcriptPath)) {
        return
    }

    const fileStream = fs.createReadStream(transcriptPath);
    const lines = rl.createInterface({ input: fileStream });

    for await (const line of lines) {
        yield line;
    }
}
