# test_cflu_pool_build.py — unit tests for the pure functions in CFLU_Pool_Build.py
# Run: python test_cflu_pool_build.py  (or: python -m unittest test_cflu_pool_build)
# Covers classify(), clean_song()/SUFFIX_RE, dedup_pool(), bpm_group(), _track_for_js(),
# find_decisive_genre_tag(), is_modern_year() — pure functions only, no network/filesystem.
import json
import unittest

import CFLU_Pool_Build as plb


class ClassifyTests(unittest.TestCase):
    def test_edm_requires_high_bpm(self):
        self.assertEqual(plb.classify('house', '', 130), 'EDM / Electronic')
        # Same tag below the BPM threshold falls through to a later bucket, not EDM
        self.assertNotEqual(plb.classify('house', '', 100), 'EDM / Electronic')

    def test_ska_beats_punk_on_tie_weight(self):
        self.assertEqual(plb.classify('ska punk', '', 140), 'Ska & Reggae')

    def test_reggae_excludes_dubstep(self):
        self.assertNotEqual(plb.classify('reggae dubstep', '', 140), 'Ska & Reggae')

    def test_metal_before_synth_for_industrial(self):
        self.assertEqual(plb.classify('industrial metal', '', 140), 'Metal & Hard Rock')

    def test_german_keyword_wins(self):
        self.assertEqual(plb.classify('schlager', '', 120), 'Deutsche Musik')

    def test_rock_keyword(self):
        self.assertEqual(plb.classify('alternative rock', '', 120), 'Rock')

    def test_hip_hop_before_funk(self):
        self.assertEqual(plb.classify('trap soul', '', 120), 'Hip Hop / Rap')

    def test_unknown_tag_falls_back_to_pop(self):
        self.assertEqual(plb.classify('completely unknown genre xyz', '', 120), 'Pop & New Wave')

    def test_electronic_parent_fallback_respects_bpm(self):
        self.assertEqual(plb.classify('', 'electronic', 130), 'EDM / Electronic')
        self.assertEqual(plb.classify('', 'electronic', 90), 'Synthwave / Electronica')


class SuffixCleanupTests(unittest.TestCase):
    """Cross-language fixture parity with js/cflu_tests.js's titleKey() suite —
    keep both in sync if SUFFIX_RE changes (see the comment at each definition)."""

    def test_radio_edit_removed(self):
        self.assertEqual(plb.clean_song('Song (Radio Edit)'), 'Song')

    def test_remastered_with_year_after(self):
        self.assertEqual(plb.clean_song('Song - Remastered 2018'), 'Song')

    def test_year_before_remaster(self):
        # This is the exact case that was missing from js/config.js's SUFFIX_RE (Issue #202 review)
        self.assertEqual(plb.clean_song('Song Title - 2009 Remaster'), 'Song Title')
        self.assertEqual(plb.clean_song('Song Title (2009 Remaster)'), 'Song Title')

    def test_feat_removed(self):
        self.assertEqual(plb.clean_song('Song feat. Artist'), 'Song')

    def test_extended_mix_removed(self):
        self.assertEqual(plb.clean_song('Song Extended Mix'), 'Song')

    def test_plain_title_unchanged(self):
        self.assertEqual(plb.clean_song('Plain Title'), 'Plain Title')


class DedupPoolTests(unittest.TestCase):
    def test_removes_case_insensitive_duplicate(self):
        tracks = [
            {'id': 't1', 'artist': 'Band A', 'song': 'Song One', 'locked': 0},
            {'id': 't2', 'artist': 'band a', 'song': 'song one', 'locked': 0},
        ]
        result = plb.dedup_pool(tracks)
        self.assertEqual(len(result), 1)

    def test_locked_track_wins_over_unlocked_duplicate(self):
        tracks = [
            {'id': 't1', 'artist': 'Band A', 'song': 'Song One', 'locked': 0},
            {'id': 't2', 'artist': 'Band A', 'song': 'Song One', 'locked': 1},
        ]
        result = plb.dedup_pool(tracks)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['id'], 't2')

    def test_distinct_tracks_both_kept(self):
        tracks = [
            {'id': 't1', 'artist': 'Band A', 'song': 'Song One', 'locked': 0},
            {'id': 't2', 'artist': 'Band B', 'song': 'Song Two', 'locked': 0},
        ]
        result = plb.dedup_pool(tracks)
        self.assertEqual(len(result), 2)


class BpmGroupTests(unittest.TestCase):
    def test_boundaries(self):
        self.assertEqual(plb.bpm_group(0), 'A')
        self.assertEqual(plb.bpm_group(89), 'A')
        self.assertEqual(plb.bpm_group(90), 'B')
        self.assertEqual(plb.bpm_group(175), 'I')
        self.assertEqual(plb.bpm_group(999), 'I')


class TrackForJsTests(unittest.TestCase):
    def test_strips_parent_genres(self):
        t = {'id': 't1', 'song': 'S', 'parent_genres': ['rock']}
        out = plb._track_for_js(t)
        self.assertNotIn('parent_genres', out)
        self.assertEqual(out['id'], 't1')

    def test_json_serializable(self):
        t = {'id': 't1', 'song': 'S', 'parent_genres': ['rock'], 'genres_raw': ['indie rock']}
        out = plb._track_for_js(t)
        json.dumps(out)  # must not raise


class FindDecisiveGenreTagTests(unittest.TestCase):
    def test_returns_tag_that_alone_reproduces_classification(self):
        tag = plb.find_decisive_genre_tag(['ambient', 'house'], 'EDM / Electronic', 130)
        self.assertEqual(tag, 'house')

    def test_falls_back_to_first_tag_when_none_decisive(self):
        tag = plb.find_decisive_genre_tag(['completely unknown xyz'], 'Pop & New Wave', 120)
        self.assertEqual(tag, 'completely unknown xyz')

    def test_empty_list_returns_none(self):
        self.assertIsNone(plb.find_decisive_genre_tag([], 'Rock', 120))


class IsModernYearTests(unittest.TestCase):
    def test_modern(self):
        self.assertTrue(plb.is_modern_year('2015-03-01'))

    def test_not_modern(self):
        self.assertFalse(plb.is_modern_year('1995-03-01'))

    def test_empty_or_malformed(self):
        self.assertFalse(plb.is_modern_year(''))
        self.assertFalse(plb.is_modern_year('not-a-year'))


if __name__ == '__main__':
    unittest.main()
