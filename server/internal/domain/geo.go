package domain

import "math"

const earthRadiusM = 6371000

// DistanceM is the great-circle (haversine) distance between two points, in
// meters.
func DistanceM(lat1, lng1, lat2, lng2 float64) float64 {
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLng := (lng2 - lng1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusM * math.Asin(math.Min(1, math.Sqrt(a)))
}

const (
	// CheckInMinRadiusM is how far from a venue's point a check-in can be
	// whatever the fix's accuracy: a venue's coordinates are one point on a
	// building, and a club can be a big one.
	CheckInMinRadiusM = 150
	// CheckInMaxRadiusM caps how far a vague fix stretches that.
	CheckInMaxRadiusM = 400
	// CheckInMaxAccuracyM is the vaguest fix a check-in takes at all.
	CheckInMaxAccuracyM = 1000
)

// CheckInRadiusM is how far from the venue a check-in with a fix of the
// given accuracy (meters, 0 if unknown) can be.
func CheckInRadiusM(accuracyM float64) float64 {
	return math.Max(CheckInMinRadiusM, math.Min(accuracyM, CheckInMaxRadiusM))
}
