# gconfig

gconfig is the shared library used by Gordian to configure applications.
It supports environment variables, AWS Secret Manager, defaults etc.

```
const conf = new config.Config({
  awsPrefix: "GCONFIG_",
  secretsmanagerPrefix: "myapp",
  notFoundFn: ({env, secretsmanager}) => {
    console.log("NOT FOUND", env, secretsmanager);
  }
})

const test_str = await conf.string({env: "TEST_VAR_STR", secretsmanager: "TEST_VAR_STR", required: true});
console.log("TEST_VAR_STR", test_str);
```
