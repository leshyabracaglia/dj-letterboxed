package domain

import (
	"math"
	"testing"
)

func TestDistanceM(t *testing.T) {
	cases := []struct {
		name                   string
		lat1, lng1, lat2, lng2 float64
		want, tolerance        float64
	}{
		{"same point", 52.511, 13.443, 52.511, 13.443, 0, 0.01},
		{"two Berlin blocks apart", 52.5111, 13.4430, 52.5103, 13.4348, 560, 20},
		{"one degree of latitude", 0, 0, 1, 0, 111195, 10},
	}
	for _, c := range cases {
		got := DistanceM(c.lat1, c.lng1, c.lat2, c.lng2)
		if math.Abs(got-c.want) > c.tolerance {
			t.Errorf("%s: DistanceM = %.1f, want %.1f ± %.1f", c.name, got, c.want, c.tolerance)
		}
	}
}

func TestCheckInRadiusM(t *testing.T) {
	cases := map[float64]float64{
		0:   CheckInMinRadiusM,
		30:  CheckInMinRadiusM,
		250: 250,
		900: CheckInMaxRadiusM,
	}
	for accuracy, want := range cases {
		if got := CheckInRadiusM(accuracy); got != want {
			t.Errorf("CheckInRadiusM(%v) = %v, want %v", accuracy, got, want)
		}
	}
}
