from app.scorers._math import camelot_compatible, cosine, jaccard


def test_cosine_identity():
    assert abs(cosine([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) - 1.0) < 1e-9


def test_cosine_orthogonal():
    assert cosine([1.0, 0.0], [0.0, 1.0]) == 0.0


def test_jaccard_basic():
    assert jaccard({"a", "b", "c"}, {"b", "c", "d"}) == 0.5


def test_camelot_self_match():
    # C major to C major should be perfect
    assert camelot_compatible(0, 1, 0, 1) == 1.0


def test_camelot_unrelated():
    # major to minor of unrelated key should be low
    assert camelot_compatible(0, 1, 6, 0) < 0.5
