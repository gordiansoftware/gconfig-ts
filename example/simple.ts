import * as g from "gconfig";
import * as d from "debug";

const log = d("gconfig:example");
log("foo");

const config = new g.Config({
  awsPrefix: "GCONFIG_",
  secretsmanagerPrefix: "centaur",
  notFoundFn: (key: string) => {
    const log = d("gconfig:example:not_found");
    log(`Key ${key} not found`);
  },
});

async function main() {
  const someConfig = await config.string({
    env: "FOO",
    secretsmanager: "FOO",
    required: true,
  });
  log("user = %s", someConfig);
}

main().then(() => console.log("Done"));
