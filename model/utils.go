package model

import (
	"errors"
	"fmt"
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

func batchSingleColumnSQL(table, column string, updates map[int]int) string {
	cases := make([]string, 0, len(updates))
	ids := make([]string, 0, len(updates))
	for id, value := range updates {
		ids = append(ids, fmt.Sprintf("%d", id))
		cases = append(cases, fmt.Sprintf("WHEN %d THEN %s + %d", id, column, value))
	}
	return fmt.Sprintf(
		"UPDATE %s SET %s = CASE id %s END WHERE id IN (%s)",
		table, column,
		strings.Join(cases, " "),
		strings.Join(ids, ","),
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

	common.SysLog("batch update started")

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
			if err := DB.Exec(batchSingleColumnSQL("tokens", "quota", store)).Error; err != nil {
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

	common.SysLog("batch update finished")
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
