const providerVariables = [
  "GOOGLE_SAFE_BROWSING_API_KEY",
  "URLHAUS_AUTH_KEY",
  "MALWAREBAZAAR_API_KEY",
];

const missing = providerVariables.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Provider activation is incomplete. Missing: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("All reputation-provider credentials are present in this environment.");
}
