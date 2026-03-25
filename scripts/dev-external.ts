import "dotenv/config";

process.env.NODE_ENV ||= "development";
process.env.DEPLOY_MODE ||= "external";

void import("../server/_core/index.ts");
