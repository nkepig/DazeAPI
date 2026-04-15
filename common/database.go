package common

const DatabaseTypePostgreSQL = "postgres"
const DatabaseTypeMySQL = "mysql"

// UsingPostgreSQL is always true now — only PostgreSQL is supported.
var UsingPostgreSQL = true

// UsingSQLite and UsingMySQL are always false; kept for compile compatibility with legacy code paths.
var UsingSQLite = false
var UsingMySQL = false

// LogSqlType indicates the log database type; empty means same as main DB.
var LogSqlType = ""

// SQLitePath is kept for potential future use but is currently unused.
var SQLitePath = "one-api.db?_busy_timeout=30000"