#!/bin/bash
set -e

if [ -f "$(dirname $0)/.env" ]; then
    source "$(dirname $0)/.env"
else
    echo "错误：缺少.env配置文件，请复制.env.example为.env并填写配置"
    exit 1
fi

mkdir -p ${BACKUP_DIR}
if [ ! -w ${BACKUP_DIR} ]; then
    echo "错误：备份目录${BACKUP_DIR}无写入权限"
    exit 1
fi

BACKUP_FILENAME="${DB_NAME}_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

if ! command -v mysqldump &> /dev/null; then
    echo "错误：未找到mysqldump，请安装MySQL客户端"
    exit 1
fi

echo "开始备份数据库 ${DB_NAME} 到 ${BACKUP_PATH}..."
mysqldump -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} \
    --single-transaction \
    --skip-lock-tables \
    ${DB_NAME} | gzip > ${BACKUP_PATH}

if [ ! -f ${BACKUP_PATH} ] || [ $(stat -c%s ${BACKUP_PATH}) -lt 100 ]; then
    echo "错误：备份失败，文件不完整或为空"
    rm -f ${BACKUP_PATH}
    exit 1
fi

echo "清理${RETAIN_DAYS}天前的备份文件..."
find ${BACKUP_DIR} -name "${DB_NAME}_backup_*.sql.gz" -type f -mtime +${RETAIN_DAYS} -delete

echo "备份完成！文件：${BACKUP_PATH}"
exit 0