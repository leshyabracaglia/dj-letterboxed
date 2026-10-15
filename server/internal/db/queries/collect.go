package queries

import "github.com/jackc/pgx/v5"

// rowsOf adapts one of this package's single-row scanners (scanDj,
// scanUser, ...) for pgx.CollectRows.
func rowsOf[T any](scan func(pgx.Row) (*T, error)) pgx.RowToFunc[T] {
	return func(row pgx.CollectableRow) (T, error) {
		v, err := scan(row)
		if err != nil {
			var zero T
			return zero, err
		}
		return *v, nil
	}
}

// collect runs pgx.CollectRows on the (rows, err) a Query returned.
func collect[T any](rows pgx.Rows, err error, scan pgx.RowToFunc[T]) ([]T, error) {
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scan)
}

// collectMap collects rows into a map keyed by key(value).
func collectMap[K comparable, V any](rows pgx.Rows, err error, scan pgx.RowToFunc[V], key func(V) K) (map[K]V, error) {
	values, err := collect(rows, err, scan)
	if err != nil {
		return nil, err
	}
	out := make(map[K]V, len(values))
	for _, v := range values {
		out[key(v)] = v
	}
	return out, nil
}

// keyed is a row of something plus the id it belongs to, for grouping.
type keyed[V any] struct {
	Key   string
	Value V
}

// collectGrouped collects rows of (key, value) into slices by key, keeping
// row order within each. Keys with no rows are absent.
func collectGrouped[V any](rows pgx.Rows, err error, scan pgx.RowToFunc[keyed[V]]) (map[string][]V, error) {
	pairs, err := collect(rows, err, scan)
	if err != nil {
		return nil, err
	}
	out := make(map[string][]V)
	for _, p := range pairs {
		out[p.Key] = append(out[p.Key], p.Value)
	}
	return out, nil
}
