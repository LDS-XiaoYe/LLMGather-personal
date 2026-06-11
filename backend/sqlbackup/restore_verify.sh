#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

for env_file in "${REPO_ROOT}/backend/.env" "${REPO_ROOT}/.env" "${SCRIPT_DIR}/.env" "${REPO_ROOT}/.env.docker"; do
    if [ -f "${env_file}" ]; then
        set -a
        # shellcheck disable=SC1090
        source "${env_file}"
        set +a
    fi
done

DB_NAME="${DB_NAME:-${MYSQL_DATABASE:-llmgather}}"
DB_HOST="${DB_HOST:-${MYSQL_HOST:-127.0.0.1}}"
DB_PORT="${DB_PORT:-${MYSQL_PORT:-${MYSQL_DEV_PORT:-3306}}}"
DB_USER="${DB_USER:-${MYSQL_USER:-root}}"
DB_PASSWORD="${DB_PASSWORD:-${MYSQL_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}}"

if [ $# -ne 1 ]; then
    echo "使用方法：$0 <备份文件路径>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "错误：备份文件不存在"
    exit 1
fi

read -r -p "警告：此操作会覆盖数据库 ${DB_NAME}，请确认（输入yes继续）：" CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "取消恢复"
    exit 0
fi

echo "开始恢复备份到数据库 ${DB_NAME}..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gzip -t "${BACKUP_FILE}"
    gzip -dc "${BACKUP_FILE}" | MYSQL_PWD="${DB_PASSWORD}" mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" "${DB_NAME}"
else
    MYSQL_PWD="${DB_PASSWORD}" mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" "${DB_NAME}" < "${BACKUP_FILE}"
fi

echo "恢复完成！"
