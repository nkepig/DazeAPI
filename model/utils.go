package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

const (
	BatchUpdateTypeUserQuota = iota
	BatchUpdateTypeTokenQuota
	BatchUpdateTypeUsedQuota
	BatchUpdateTypeChannelUsedQuota
	BatchUpdateTypeRequestCount
	BatchUpdateTypeCount
)

var batchUpdateStores []map[int]int
var batchUpdateLocks []sync.Mutex

func init() {
	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateStores = append(batchUpdateStores, make(map[int]int))
		batchUpdateLocks = append(batchUpdateLocks, sync.Mutex{})
	}
}

func InitBatchUpdater() {
	gopool.Go(func() {
		for {
			time.Sleep(time.Duration(common.BatchUpdateInterval) * time.Second)
			batchUpdate()
		}
	})
}

func addNewRecord(type_ int, id int, value int) {
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	if _, ok := batchUpdateStores[type_][id]; !ok {
		batchUpdateStores[type_][id] = value
	} else {
		batchUpdateStores[type_][id] += value
	}
}

// pendingBatchDelta returns in-memory quota deltas that have not been flushed
// to DB yet. Used when reconstructing Redis cache after a miss so the rebuilt
// Quota matches the live HINCRBY value instead of a stale DB snapshot.
func pendingBatchDelta(type_ int, id int) int {
	if !common.BatchUpdateEnabled || type_ < 0 || type_ >= BatchUpdateTypeCount {
		return 0
	}
	batchUpdateLocks[type_].Lock()
	defer batchUpdateLocks[type_].Unlock()
	return batchUpdateStores[type_][id]
}

func sortedUpdateIDs(updates map[int]int) []int {
	ids := make([]int, 0, len(updates))
	for id := range updates {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	return ids
}

func batchSingleColumnSQL(table, column string, updates map[int]int) string {
	ids := sortedUpdateIDs(updates)
	cases := make([]string, 0, len(ids))
	idStrs := make([]string, 0, len(ids))
	for _, id := range ids {
		idStrs = append(idStrs, fmt.Sprintf("%d", id))
		cases = append(cases, fmt.Sprintf("WHEN %d THEN %s + %d", id, column, updates[id]))
	}
	return fmt.Sprintf(
		"UPDATE %s SET %s = CASE id %s END WHERE id IN (%s)",
		table, column,
		strings.Join(cases, " "),
		strings.Join(idStrs, ","),
	)
}

// tokens 表没有 quota 列，批量扣费必须同时改 remain_quota 和 used_quota，语义与 increaseTokenQuota/decreaseTokenQuota 一致。
func batchTokenQuotaSQL(updates map[int]int, accessedTime int64) string {
	ids := sortedUpdateIDs(updates)
	remainCases := make([]string, 0, len(ids))
	usedCases := make([]string, 0, len(ids))
	idStrs := make([]string, 0, len(ids))
	for _, id := range ids {
		value := updates[id]
		idStrs = append(idStrs, fmt.Sprintf("%d", id))
		remainCases = append(remainCases, fmt.Sprintf("WHEN %d THEN remain_quota + %d", id, value))
		usedCases = append(usedCases, fmt.Sprintf("WHEN %d THEN used_quota - %d", id, value))
	}
	return fmt.Sprintf(
		"UPDATE tokens SET remain_quota = CASE id %s END, used_quota = CASE id %s END, accessed_time = %d WHERE id IN (%s)",
		strings.Join(remainCases, " "),
		strings.Join(usedCases, " "),
		accessedTime,
		strings.Join(idStrs, ","),
	)
}

func batchUpdate() {
	hasData := false
	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateLocks[i].Lock()
		if len(batchUpdateStores[i]) > 0 {
			hasData = true
			batchUpdateLocks[i].Unlock()
			break
		}
		batchUpdateLocks[i].Unlock()
	}

	if !hasData {
		return
	}

	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateLocks[i].Lock()
		store := batchUpdateStores[i]
		batchUpdateStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()

		if len(store) == 0 {
			continue
		}

		switch i {
		case BatchUpdateTypeUserQuota:
			if err := DB.Exec(batchSingleColumnSQL("users", "quota", store)).Error; err != nil {
				common.SysLog("failed to batch update user quota: " + err.Error())
			}
		case BatchUpdateTypeTokenQuota:
			if err := DB.Exec(batchTokenQuotaSQL(store, common.GetTimestamp())).Error; err != nil {
				common.SysLog("failed to batch update token quota: " + err.Error())
			}
		case BatchUpdateTypeUsedQuota:
			if err := DB.Exec(batchSingleColumnSQL("users", "used_quota", store)).Error; err != nil {
				common.SysLog("failed to batch update user used quota: " + err.Error())
			}
		case BatchUpdateTypeRequestCount:
			if err := DB.Exec(batchSingleColumnSQL("users", "request_count", store)).Error; err != nil {
				common.SysLog("failed to batch update user request count: " + err.Error())
			}
		case BatchUpdateTypeChannelUsedQuota:
			if err := DB.Exec(batchSingleColumnSQL("channels", "used_quota", store)).Error; err != nil {
				common.SysLog("failed to batch update channel used quota: " + err.Error())
			}
		}
	}
}

func RecordExist(err error) (bool, error) {
	if err == nil {
		return true, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return false, err
}

func shouldUpdateRedis(fromDB bool, err error) bool {
	return common.RedisEnabled && fromDB && err == nil
}
