package httpapi

import "net/http"

// minIOSBuild is the oldest iOS build number (CFBundleVersion, EAS's
// auto-incremented buildNumber) still allowed to use the app. Anything older
// gets a blocking "update required" screen. To force an update: once the new
// build is live in TestFlight, set this to its build number and push - the
// server deploy picks it up. 0 disables the check.
const minIOSBuild = 0

// iosUpdateURL opens the app's page in the TestFlight app (ascAppId from
// eas.json). Swap for the App Store URL once the app is publicly released.
const iosUpdateURL = "itms-beta://beta.itunes.apple.com/v1/app/6812424146"

type AppVersionResponse struct {
	MinIOSBuild  int    `json:"minIosBuild"`
	IOSUpdateURL string `json:"iosUpdateUrl"`
}

// GetAppVersion godoc
//
//	@Summary	Minimum supported native app build, for the client's force-update check
//	@Tags		app
//	@Produce	json
//	@Success	200	{object}	AppVersionResponse
//	@Router		/api/app-version [get]
func (h *Handlers) GetAppVersion(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, AppVersionResponse{
		MinIOSBuild:  minIOSBuild,
		IOSUpdateURL: iosUpdateURL,
	})
}
