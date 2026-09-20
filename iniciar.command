#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_dir=$(CDPATH= cd -- "$project_dir/../.." && pwd)
cd "$project_dir"
if [ ! -f .env ]; then
  echo 'Configure .env seguindo o README antes de iniciar.'
  exit 1
fi
local_java="$task_dir/work/tools/jdk-21.0.12.1+1/Contents/Home/bin/java"
local_jar="$task_dir/work/stockflow-target/stockflow-1.0.0.jar"
if [ -x "$local_java" ] && [ -f "$local_jar" ]; then
  echo 'StockFlow: abra http://localhost:8080 após a inicialização. Ctrl+C encerra o aplicativo.'
  exec "$local_java" -jar "$local_jar"
fi
if command -v mvn >/dev/null 2>&1; then
  exec mvn spring-boot:run
fi
echo 'Instale Java 21 e Maven 3.9+ ou use Docker conforme o README.'
exit 1
