# obsidian-test

#### ⚠️ Beta software — APIs and behavior may change

Run automated tests for your **Obsidian plugins inside Obsidian itself**.

`obsidian-test` launches a real Obsidian instance with a test runner plugin installed in a temporary vault, runs your tests inside the application, collects the results, and exits with a proper CI-friendly status code.

This makes it possible to test **actual plugin behavior inside the real Obsidian runtime**, not just mocks.

---

## Features

* 🧪 Run tests **inside the real Obsidian app**
* ⚡ Fast repeat runs via **result caching**
* 🧰 Built on **`node:test`**
* 🤖 **CI-friendly** exit codes (`0` success, `1` failure)
* 🗂 Automatically creates a **temporary vault**
* 🔌 Automatically bundles and installs your plugin
* 🔁 Replays cached logs when nothing has changed

---

# Installation

```bash
npm install --save-dev obsidian-test
```

---

# Quick Start

### 1. Write a test

Create a test file anywhere in your plugin project:

```ts
import { embedded } from "obsidian-test";
import test from "node:test";

embedded(app => {
  test("run inside obsidian", () => {
    // Access the Obsidian API
    console.log(app.workspace);

    // Assert behavior here
  });
});
```

`embedded()` ensures the test only runs **inside the Obsidian runtime**.

---

### 2. Run tests

```bash
npx obsidian-test
```

This will:

1. Bundle your plugin
2. Detect test files
3. Create a temporary test vault
4. Install your plugin into that vault
5. Launch Obsidian
6. Run tests inside the app
7. Report results
8. Exit with a proper exit code

---

# How It Works

`obsidian-test` bridges the CLI and the Obsidian runtime.

### Test Run Flow

1. A plugin is bundled with any detected test files
2. A **temporary vault** is created
3. The plugin is installed into the vault
4. A **local test server** is started
5. Obsidian launches pointing at the vault
6. The plugin connects to the server
7. Tests run using `node:test`
8. Results stream back to the CLI
9. Obsidian closes automatically
10. CLI exits with:

| Code | Meaning          |
| ---- | ---------------- |
| `0`  | All tests passed |
| `1`  | Tests failed     |

---

# Cached Runs

If the following haven't changed:

* plugin source code
* test files
* test output
* Obsidian version

`obsidian-test` will **skip launching Obsidian** and instead replay the previous test output.

This allows:

* fast local test runs
* committing test results
* CI verifying the results against the current Obsidian version

If you want to ignore the cache:

```bash
npx obsidian-test --force
```

---

# CLI Usage

```
obsidian-test [options]
```

### Options

| Option                          | Description														|
| ------------------------------- | --------------------------------------------------------------- | 
| `-p, --testPattern <pattern>`   | Glob pattern for test files (default: `./**/*{test|spec.{js|ts} |
| `--cache-path <path>`           | Path to cache directory                                         |
| `--vault-path <path>`           | Path to vault directory											|
| `--obsidian-cmd <cmd>`          | Command used to launch Obsidian (default: `obsidian`)			|
| `--obsidian-config-path <path>` | Path to `obsidian.json` containing registered vaults			|
| `--force`                       | Ignore cache and rerun tests									|

Example:

```bash
obsidian-test --force
```

---

# Writing Tests

Tests run using Node's built-in test runner.

```ts
import { embedded } from "obsidian-test";
import test from "node:test";

embedded(app => {
  test("workspace loads", () => {
    if (!app.workspace) {
      throw new Error("Workspace missing");
    }
  });
});
```

Inside `embedded()` you have access to:

* the `app` instance
* any Obsidian imports
* your plugin code

---

# Using `obsidian-test` as a Library

You can also use `obsidian-test` to programmatically launch Obsidian for tooling or plugin previews.

```ts
import { runObsidian } from "obsidian-test/node";

await runObsidian({
  plugins: [
    {
      manifest: { id: "my-plugin-id" },

      artifact: {
        code: "<javascript code>",
        style: "<css code>", // optional
      },

      data: {}, // optional plugin data
      enabled: true // optional (default: true)
    }
  ]
});
```

This will launch Obsidian with the specified plugins installed.

This is useful for:

* plugin preview tools
* development workflows
* automation
* integration testing

---

# Requirements

* Obsidian installed and accessible from your system command line

If your system doesn't expose the `obsidian` command, you can configure it:

```bash
obsidian-test --obsidian-cmd "/Applications/Obsidian.app/Contents/MacOS/Obsidian"
```

---

# CI Example

```yaml
- run: npm install
- run: npx obsidian-test
```

Because `obsidian-test` exits with proper status codes, CI will fail automatically when tests fail.

