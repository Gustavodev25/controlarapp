#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');
const marker = 'CONTROLARAPP_EXPO_ENV_GUARD';
const needle = "require('@expo/cli');";

const guard = `// ${marker}: normalize plain "npx expo start" for local Expo Go development.
function controlarHasArgValue(flag, value) {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1] === value;
}

function controlarHasStartTargetArg() {
  return (
    process.argv.includes('--go') ||
    process.argv.includes('-g') ||
    process.argv.includes('--dev-client') ||
    process.argv.includes('-d')
  );
}

const controlarIsExpoStart = process.argv[2] === 'start';
const controlarUsesExplicitTunnel =
  process.argv.includes('--tunnel') ||
  controlarHasArgValue('--host', 'tunnel') ||
  controlarHasArgValue('-m', 'tunnel');

if (controlarIsExpoStart) {
  if (!controlarHasStartTargetArg()) {
    process.argv.push('--go');
  }

  if (!controlarUsesExplicitTunnel) {
    if (/ngrok/i.test(process.env.REACT_NATIVE_PACKAGER_HOSTNAME || '')) {
      delete process.env.REACT_NATIVE_PACKAGER_HOSTNAME;
    }

    if (
      process.env.CONTROLAR_KEEP_PACKAGER_PROXY !== '1' &&
      /ngrok/i.test(process.env.EXPO_PACKAGER_PROXY_URL || '')
    ) {
      delete process.env.EXPO_PACKAGER_PROXY_URL;
    }
  }
}

`;

function main() {
  if (!fs.existsSync(cliPath)) {
    console.warn('[patch-expo-cli] Expo CLI entrypoint not found; skipping.');
    return;
  }

  const source = fs.readFileSync(cliPath, 'utf8');
  const escapedNeedle = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingGuardPattern = new RegExp(`// ${marker}:[\\s\\S]*?${escapedNeedle}`);

  if (!existingGuardPattern.test(source) && !source.includes(needle)) {
    console.warn('[patch-expo-cli] Unexpected Expo CLI entrypoint format; skipping.');
    return;
  }

  const nextSource = existingGuardPattern.test(source)
    ? source.replace(existingGuardPattern, guard + needle)
    : source.replace(needle, guard + needle);

  if (nextSource !== source) {
    fs.writeFileSync(cliPath, nextSource);
    console.log('[patch-expo-cli] Patched Expo CLI start guard.');
  }
}

main();
