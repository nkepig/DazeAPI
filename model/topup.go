package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type TopUp struct {
	Id            int     `json:"id"`
	UserId        int     `json:"user_id" gorm:"index"`
	Amount        int64   `json:"amount"`
	Money         float64 `json:"money"`
	TradeNo       string  `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod string  `json:"payment_method" gorm:"type:varchar(50)"`
	QrUrl         string  `json:"qr_url" gorm:"type:varchar(500)"`
	CreateTime    int64   `json:"create_time"`
	CompleteTime  int64   `json:"complete_time"`
	Status        string  `json:"status"`
}

// TopUpAdmin 管理员全平台充值列表（附带用户信息）
type TopUpAdmin struct {
	TopUp
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

func enrichTopUpsAdmin(topups []*TopUp) []*TopUpAdmin {
	if len(topups) == 0 {
		return nil
	}
	seen := make(map[int]bool)
	var ids []int
	for _, t := range topups {
		if t == nil || seen[t.UserId] {
			continue
		}
		seen[t.UserId] = true
		ids = append(ids, t.UserId)
	}
	var users []User
	um := make(map[int]User)
	if len(ids) > 0 {
		_ = DB.Where("id IN ?", ids).Select("id", "username", "display_name").Find(&users).Error
		for i := range users {
			um[users[i].Id] = users[i]
		}
	}
	out := make([]*TopUpAdmin, len(topups))
	for i, t := range topups {
		if t == nil {
			continue
		}
		u := um[t.UserId]
		out[i] = &TopUpAdmin{
			TopUp:       *t,
			Username:    u.Username,
			DisplayName: u.DisplayName,
		}
	}
	return out
}

func (topUp *TopUp) Insert() error {
	var err error
	err = DB.Create(topUp).Error
	return err
}

func (topUp *TopUp) Update() error {
	var err error
	err = DB.Save(topUp).Error
	return err
}

func GetTopUpByTradeNo(tradeNo string) *TopUp {
	var topUp *TopUp
	var err error
	err = DB.Where("trade_no = ?", tradeNo).First(&topUp).Error
	if err != nil {
		return nil
	}
	return topUp
}

func CompleteTopUp(topUp *TopUp, quota int64) error {
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	var completed bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", topUp.TradeNo).First(topUp).Error; err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.Status != common.TopUpStatusPending {
			return nil
		}

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
			return err
		}

		completed = true
		return nil
	})
	if err != nil {
		return err
	}
	if completed {
		syncUserQuotaCacheIncr(topUp.UserId, quota)
		RecordLog(topUp.UserId, LogTypeTopup, fmt.Sprintf("在线充值成功，充值额度: %v，支付金额：%.2f 元，订单号: %s", logger.FormatQuota(int(quota)), topUp.Money, topUp.TradeNo))
	}
	return nil
}

func GetUserTopUps(userId int, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	// Start transaction
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	finishedStatus := []string{common.TopUpStatusSuccess, common.TopUpStatusFailed}

	// Get total count within transaction
	err = tx.Model(&TopUp{}).Where("user_id = ?", userId).Where("status IN ?", finishedStatus).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated topups within same transaction
	err = tx.Where("user_id = ?", userId).Where("status IN ?", finishedStatus).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Commit transaction
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// GetAllTopUps 获取全平台的充值记录（管理员使用，含用户名）
func GetAllTopUps(pageInfo *common.PageInfo) (items []*TopUpAdmin, total int64, err error) {
	var topups []*TopUp
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	finishedStatus := []string{common.TopUpStatusSuccess, common.TopUpStatusFailed}

	if err = tx.Model(&TopUp{}).Where("status IN ?", finishedStatus).Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Where("status IN ?", finishedStatus).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return enrichTopUpsAdmin(topups), total, nil
}

// SearchUserTopUps 按订单号搜索某用户的充值记录
func SearchUserTopUps(userId int, keyword string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	finishedStatus := []string{common.TopUpStatusSuccess, common.TopUpStatusFailed}
	query := tx.Model(&TopUp{}).Where("user_id = ?", userId).Where("status IN ?", finishedStatus)
	if keyword != "" {
		like := "%%" + keyword + "%%"
		query = query.Where("trade_no LIKE ?", like)
	}

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return topups, total, nil
}

// SearchAllTopUps 按订单号搜索全平台充值记录（管理员使用，含用户名）
func SearchAllTopUps(keyword string, pageInfo *common.PageInfo) (items []*TopUpAdmin, total int64, err error) {
	var topups []*TopUp
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	finishedStatus := []string{common.TopUpStatusSuccess, common.TopUpStatusFailed}
	query := tx.Model(&TopUp{}).Where("status IN ?", finishedStatus)
	if keyword != "" {
		like := "%%" + keyword + "%%"
		query = query.Where("trade_no LIKE ?", like)
	}

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return enrichTopUpsAdmin(topups), total, nil
}

// ManualCompleteTopUp 管理员手动完成订单并给用户充值
func ManualCompleteTopUp(tradeNo string) error {
	if tradeNo == "" {
		return errors.New("未提供订单号")
	}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	var userId int
	var quotaToAdd int
	var payMoney float64

	err := DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		// 行级锁，避免并发补单
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return errors.New("充值订单不存在")
		}

		// 幂等处理：已成功直接返回
		if topUp.Status == common.TopUpStatusSuccess {
			return nil
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("订单状态不是待支付，无法补单")
		}

		if topUp.PaymentMethod == "stripe" {
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd = int(decimal.NewFromFloat(topUp.Money).Mul(dQuotaPerUnit).IntPart())
		} else if topUp.PaymentMethod == "alipay" || topUp.PaymentMethod == "epay" {
			dMicrodollarsPerUnit := decimal.NewFromFloat(common.MicrodollarsPerUnit)
			quotaToAdd = int(decimal.NewFromFloat(topUp.Money).Mul(dMicrodollarsPerUnit).IntPart())
		} else {
			dAmount := decimal.NewFromInt(topUp.Amount)
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd = int(dAmount.Mul(dQuotaPerUnit).IntPart())
		}
		if quotaToAdd <= 0 {
			return errors.New("无效的充值额度")
		}

		// 标记完成
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		// 增加用户额度（立即写库，保持一致性）
		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}

		userId = topUp.UserId
		payMoney = topUp.Money
		return nil
	})

	if err != nil {
		return err
	}

	if quotaToAdd > 0 && userId > 0 {
		syncUserQuotaCacheIncr(userId, int64(quotaToAdd))
	}
	// 事务外记录日志，避免阻塞
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("管理员补单成功，充值金额: %v，支付金额：%f", logger.FormatQuota(quotaToAdd), payMoney))
	return nil
}
