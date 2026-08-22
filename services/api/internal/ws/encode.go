package ws

import (
	"strconv"

	"github.com/orbica/api/internal/propagate"
)

// encodePositions writes the live stream as a flat array of numbers, five per
// satellite: [norad, lat, lng, altKm, velKmS, norad, lat, ...].
//
// The obvious encoding — an array of JSON objects — repeats six field names and
// the satellite's name on every tick for all ~16k objects. At a 5s cadence that
// was 1.7 MB per broadcast per viewer (~1.2 GB per viewer-hour), which burned a
// month of egress in four hours. Names are dropped entirely: the client already
// holds them from /api/v1/track/meta, keyed by the same NORAD id.
//
// Values are rounded at the precision the globe actually renders — ~1 m of
// ground resolution — so we don't ship float64 noise digits.
func encodePositions(ps []propagate.Position) []byte {
	// 5 numbers/sat, generously ~7 bytes each incl. separator.
	buf := make([]byte, 0, len(ps)*36+2)
	buf = append(buf, '[')
	for i, p := range ps {
		if i > 0 {
			buf = append(buf, ',')
		}
		buf = strconv.AppendInt(buf, int64(p.NoradID), 10)
		buf = append(buf, ',')
		buf = strconv.AppendFloat(buf, p.Lat, 'f', 2, 64)
		buf = append(buf, ',')
		buf = strconv.AppendFloat(buf, p.Lng, 'f', 2, 64)
		buf = append(buf, ',')
		buf = strconv.AppendFloat(buf, p.AltitudeKM, 'f', 1, 64)
		buf = append(buf, ',')
		buf = strconv.AppendFloat(buf, p.VelocityKMS, 'f', 2, 64)
	}
	return append(buf, ']')
}
