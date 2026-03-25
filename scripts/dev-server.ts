import "dotenv/config";

process.env.NODE_ENV ||= "development";

void import("../server/_core/index.ts");
