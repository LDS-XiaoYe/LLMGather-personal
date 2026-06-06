#!/bin/bash
set -e

if [ -f "$(dirname $0)/.env" ]; then
    source "$(dirname $0)/.env"
else
    echo "错误：缺少.env配置文件"
    exit 1
fi

if [ $# -ne 1 ]; then
    echo "使用方法：$0 <备份文件路径>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f ${BACKUP_FILE} ]; then
    echo "错误：备份文件不存在"
    exit 1
fi

read -p "警告：此操作会覆盖数据库${DB_NAME}，请确认（输入yes继续）：" CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "取消恢复"
    exit 0
fi

echo "开始恢复备份到数据库${DB_NAME}..."
gzip -t ${BACKUP_FILE}
gzip -dc ${BACKUP_FILE} | mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME}

echo "恢复完成！"