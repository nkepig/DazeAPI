package system_setting

// 站点基础地址（OAuth、回调、支付通知等；由系统选项同步）
var ServerAddress = "http://localhost:3000"
var WorkerUrl = ""
var WorkerValidKey = ""
var WorkerAllowHttpImageRequestEnabled = false

func EnableWorker() bool {
	return WorkerUrl != ""
}
