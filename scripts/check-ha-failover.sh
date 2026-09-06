#!/bin/bash
# ==============================================================================
# Script Kiểm tra & Giám sát Trạng thái PostgreSQL HA Replication (P08)
# ==============================================================================

set -e

MASTER_CONTAINER="csdl-db-master"
SLAVE_CONTAINER="csdl-db-slave"
DB_USER="${DB_USER:-csdl}"
DB_NAME="${DB_NAME:-csdl_doanhtrai}"

echo "======================================================================"
echo "  GIÁM SÁT TRẠNG THÁI HIGH AVAILABILITY (POSTGRESQL REPLICATION HA)"
echo "======================================================================"

# 1. Kiểm tra Nút Master
echo -n "[HA Monitor] Checking Primary Master Node ($MASTER_CONTAINER)... "
if docker exec "$MASTER_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    echo "ONLINE (Healthy)"
    IS_MASTER_RECOVERY=$(docker exec -i "$MASTER_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d '[:space:]')
    if [ "$IS_MASTER_RECOVERY" == "f" ]; then
        echo "  • Primary Role: Read-Write (Primary Node)"
    else
        echo "  • CẢNH BÁO: Master node đang ở chế độ Recovery Mode!"
    fi
else
    echo "OFFLINE / UNREACHABLE!"
fi

# 2. Kiểm tra Nút Standby Slave
echo -n "[HA Monitor] Checking Standby Replica Node ($SLAVE_CONTAINER)... "
if docker exec "$SLAVE_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    echo "ONLINE (Healthy)"
    IS_SLAVE_RECOVERY=$(docker exec -i "$SLAVE_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d '[:space:]')
    if [ "$IS_SLAVE_RECOVERY" == "t" ]; then
        echo "  • Standby Role: Read-Only Hot Standby Replica"
    else
        echo "  • CHÚ Ý: Slave node đang ở chế độ Primary (Promoted)!"
    fi
else
    echo "STANDBY DOWN (Sẽ khôi phục tự động khi khởi động)"
fi

# 3. Truy vấn bảng pg_stat_replication từ Nút Master
echo "----------------------------------------------------------------------"
echo "[HA Monitor] Streaming Replication Statistics from Master:"
docker exec -i "$MASTER_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    client_addr AS slave_ip, 
    application_name, 
    state, 
    sync_state, 
    sync_priority,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;
" 2>/dev/null || echo "Chưa có kết nối replication hoạt động."

echo "======================================================================"
