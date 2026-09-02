# test_cflu_pool_build.py — unit tests for CFLU_Pool_Build.py; hermetic: no network, no filesystem
# Run: python test_cflu_pool_build.py  (or: python -m unittest test_cflu_pool_build)
# Covers classify(), clean_song()/SUFFIX_RE, dedup_pool(), bpm_group(), _track_for_js(),
# find_decisive_genre_tag(), is_modern_year() — pure functions — plus the state-machine
# guards: merge() (Key Invariant 9), inherit_genres() (sources 0/2/4/6) and
# tag_genres_ai() (Key Invariant 10, `anthropic` + key file mocked at module level).
import contextlib
import io
import json
import sys
import unittest
from types import SimpleNamespace
from unittest import mock

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


# ===== merge() — Key Invariant 9 =====
def _quiet(fn, *args, **kwargs):
    """Run fn with its progress output swallowed (merge/tag_genres_ai print to stdout)."""
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*args, **kwargs)


def _existing_track(og, **override):
    """Pool track as load_existing() yields it (transform() shape + locked), in state og."""
    t = {
        'id': f'ex{og}', 'song': f'Song {og}', 'artist': f'Artist {og}',
        'bpm': 120, 'bpmg': 'D', 'parent_genres': [], 'album_date': None,
        'genres_raw': ['alternative rock'], 'genre': 'Rock', 'decisive_genre': 'alternative rock',
        'open_genre': og, 'mood_tags': ['hype'], 'locked': 0,
    }
    t.update(override)
    return t


def _reimport(og, **override):
    """transform() output for the same id on re-import: Spotify now reports a different genre."""
    t = {
        'id': f'ex{og}', 'song': f'Song {og}', 'artist': f'Artist {og}',
        'bpm': 130, 'bpmg': 'E', 'parent_genres': [], 'album_date': None,
        'genres_raw': ['house'], 'genre': 'EDM / Electronic', 'decisive_genre': 'house',
        'open_genre': 0, 'mood_tags': [],
    }
    t.update(override)
    return t


class MergeTests(unittest.TestCase):
    """Key Invariant 9: --rebuild never overwrites open_genre 2/3/5/6/7; mood_tags always survive."""

    def setUp(self):
        self.existing = {f'ex{og}': _existing_track(og) for og in range(8)}
        self.transformed = [_reimport(og) for og in range(8)]

    def _merge(self, rebuild):
        tracks, n_new, n_upd = _quiet(plb.merge, self.transformed, self.existing, rebuild=rebuild)
        return {t['id']: t for t in tracks}, n_new, n_upd

    def test_rebuild_preserves_full_genre_for_states_2_and_6(self):
        by_id, _, _ = self._merge(rebuild=True)
        for og in (2, 6):
            with self.subTest(open_genre=og):
                t = by_id[f'ex{og}']
                self.assertEqual(t['open_genre'], og)
                self.assertEqual(t['genres_raw'], ['alternative rock'])
                self.assertEqual(t['genre'], 'Rock')
                self.assertEqual(t['decisive_genre'], 'alternative rock')

    def test_rebuild_preserves_only_open_genre_for_states_5_and_7(self):
        by_id, _, _ = self._merge(rebuild=True)
        for og in (5, 7):
            with self.subTest(open_genre=og):
                t = by_id[f'ex{og}']
                self.assertEqual(t['open_genre'], og)
                # both-failed states carry no curated genre — the fields follow the re-import
                self.assertEqual(t['genres_raw'], ['house'])
                self.assertEqual(t['genre'], 'EDM / Electronic')
                self.assertEqual(t['decisive_genre'], 'house')

    def test_rebuild_preserves_open_genre_for_state_3(self):
        by_id, _, _ = self._merge(rebuild=True)
        self.assertEqual(by_id['ex3']['open_genre'], 3)

    @unittest.expectedFailure
    def test_rebuild_preserves_full_genre_for_state_3(self):
        # REQUIREMENTS.md §5.2 Data integrity: "Pool rebuilds MUST NOT destroy manual genre
        # curation (open_genre=3)"; PROJECT.md ADR 9: manual (open_genre=3) fields must survive.
        # merge() today preserves genres_raw/genre/decisive_genre only for states 2 and 6
        # (CLAUDE.md state table, PROJECT.md §Data Model) — the two rules conflict. State 3 is
        # not produced anywhere yet (Admin Panel #105 not built), so this pins the MUST instead
        # of enshrining the overwrite: #105 must make it pass and drop the expectedFailure.
        by_id, _, _ = self._merge(rebuild=True)
        t = by_id['ex3']
        self.assertEqual(t['open_genre'], 3)
        self.assertEqual(t['genres_raw'], ['alternative rock'])
        self.assertEqual(t['genre'], 'Rock')
        self.assertEqual(t['decisive_genre'], 'alternative rock')

    def test_rebuild_does_not_preserve_inherited_state_4(self):
        by_id, _, _ = self._merge(rebuild=True)
        t = by_id['ex4']
        # state 4 is taken verbatim from transform() — here Spotify delivered a genre → 0
        self.assertEqual(t['open_genre'], 0)
        self.assertEqual(t['genres_raw'], ['house'])
        self.assertEqual(t['genre'], 'EDM / Electronic')

    def test_rebuild_state_4_without_spotify_genre_returns_to_1(self):
        # realistic re-import: Spotify still has no genre → transform() yields 1 and merge()
        # must hand it through unchanged so inherit_genres() can recompute the inheritance
        self.transformed = [_reimport(4, genres_raw=[], open_genre=1,
                                      genre='Pop & New Wave', decisive_genre=None)]
        by_id, _, _ = self._merge(rebuild=True)
        self.assertEqual(by_id['ex4']['open_genre'], 1)
        self.assertEqual(by_id['ex4']['genres_raw'], [])

    def test_rebuild_overwrites_base_states_0_and_1(self):
        by_id, _, _ = self._merge(rebuild=True)
        for og in (0, 1):
            with self.subTest(open_genre=og):
                self.assertEqual(by_id[f'ex{og}']['open_genre'], 0)
                self.assertEqual(by_id[f'ex{og}']['genres_raw'], ['house'])

    def test_mood_tags_preserved_in_both_modes(self):
        for rebuild in (False, True):
            with self.subTest(rebuild=rebuild):
                by_id, _, _ = self._merge(rebuild=rebuild)
                for og in range(8):
                    self.assertEqual(by_id[f'ex{og}']['mood_tags'], ['hype'])

    def test_rebuild_counts_and_locked_flag(self):
        by_id, n_new, n_upd = self._merge(rebuild=True)
        self.assertEqual((n_new, n_upd), (0, 8))
        self.assertEqual(len(by_id), 8)
        self.assertTrue(all(t['locked'] == 0 for t in by_id.values()))

    def test_locked_track_skipped_in_both_modes(self):
        self.existing['ex0']['locked'] = 1
        for rebuild in (False, True):
            with self.subTest(rebuild=rebuild):
                by_id, n_new, n_upd = self._merge(rebuild=rebuild)
                self.assertIs(by_id['ex0'], self.existing['ex0'])
                self.assertEqual(by_id['ex0']['genres_raw'], ['alternative rock'])
                self.assertEqual((n_new, n_upd), (0, 7 if rebuild else 0))

    def test_add_only_leaves_existing_untouched_and_appends_new(self):
        self.transformed.append(_reimport(9))  # id ex9 is not in the pool
        tracks, n_new, n_upd = _quiet(plb.merge, self.transformed, self.existing, rebuild=False)
        by_id = {t['id']: t for t in tracks}
        self.assertEqual((n_new, n_upd), (1, 0))
        for og in range(8):
            self.assertIs(by_id[f'ex{og}'], self.existing[f'ex{og}'])  # same object, untouched
            self.assertEqual(by_id[f'ex{og}']['open_genre'], og)
        self.assertEqual(tracks[-1]['id'], 'ex9')  # appended after the existing pool order
        self.assertEqual(by_id['ex9']['locked'], 0)
        self.assertEqual(by_id['ex9']['open_genre'], 0)


# ===== inherit_genres() — 1 → 4 only from sources 0/2/4/6 =====
def _pool_track(tid, artist, og, genres_raw, bpm=120):
    return {'id': tid, 'song': tid, 'artist': artist, 'bpm': bpm, 'bpmg': 'D',
            'open_genre': og, 'genres_raw': genres_raw, 'genre': 'Pop & New Wave',
            'decisive_genre': None, 'parent_genres': [], 'album_date': None}


class InheritGenresTests(unittest.TestCase):
    def _run(self, source_og, target_og=1, source_artist='Band A', target_artist='Band A'):
        source = _pool_track('src', source_artist, source_og, ['alternative rock'])
        target = _pool_track('tgt', target_artist, target_og, [])
        count = plb.inherit_genres([source, target])
        return count, target

    def test_inherits_from_states_0_2_4_6(self):
        for og in (0, 2, 4, 6):
            with self.subTest(source_og=og):
                count, target = self._run(og)
                self.assertEqual(count, 1)
                self.assertEqual(target['open_genre'], 4)
                self.assertEqual(target['genres_raw'], ['alternative rock'])
                self.assertEqual(target['genre'], 'Rock')
                self.assertEqual(target['decisive_genre'], 'alternative rock')
                self.assertEqual(target['bpmg'], 'D')

    def test_never_inherits_from_states_1_3_5_7(self):
        for og in (1, 3, 5, 7):
            with self.subTest(source_og=og):
                count, target = self._run(og)
                self.assertEqual(count, 0)
                self.assertEqual(target['open_genre'], 1)
                self.assertEqual(target['genres_raw'], [])

    def test_source_with_empty_genres_is_ignored(self):
        source = _pool_track('src', 'Band A', 0, [])
        target = _pool_track('tgt', 'Band A', 1, [])
        self.assertEqual(plb.inherit_genres([source, target]), 0)
        self.assertEqual(target['open_genre'], 1)

    def test_only_state_1_targets_are_touched(self):
        for og in (0, 2, 3, 4, 5, 6, 7):
            with self.subTest(target_og=og):
                count, target = self._run(0, target_og=og)
                self.assertEqual(count, 0)
                self.assertEqual(target['open_genre'], og)
                self.assertEqual(target['genres_raw'], [])

    def test_artist_key_is_case_insensitive_full_string(self):
        count, target = self._run(0, source_artist='band a', target_artist='BAND A')
        self.assertEqual((count, target['open_genre']), (1, 4))
        # multi-artist strings are compared verbatim — no per-artist splitting
        count, target = self._run(0, source_artist='Band A', target_artist='Band A, Band B')
        self.assertEqual((count, target['open_genre']), (0, 1))

    def test_first_source_per_artist_wins(self):
        first  = _pool_track('s1', 'Band A', 0, ['house'], bpm=130)
        second = _pool_track('s2', 'Band A', 0, ['alternative rock'])
        target = _pool_track('tgt', 'Band A', 1, [])
        self.assertEqual(plb.inherit_genres([first, second, target]), 1)
        self.assertEqual(target['genres_raw'], ['house'])


# ===== tag_genres_ai() — Key Invariant 10 =====
class TagGenresAiTests(unittest.TestCase):
    """Hermetic: fake `anthropic` module in sys.modules, key-file check patched, no files, no network."""

    @staticmethod
    def _candidates():
        return [_pool_track('t1', 'Band A', 1, []),
                _pool_track('t4', 'Band A', 4, ['alternative rock'])]

    def _run(self, tracks, reply=None, raises=None, key_present=True, key_text='sk-test',
             module_present=True):
        fake = mock.MagicMock() if module_present else None
        create = fake.Anthropic.return_value.messages.create if module_present else None
        if raises is not None:
            create.side_effect = raises
        elif reply is not None:
            create.return_value = SimpleNamespace(content=[SimpleNamespace(text=reply)])
        with mock.patch.dict(sys.modules, {'anthropic': fake}), \
             mock.patch.object(plb.os.path, 'exists', return_value=key_present), \
             mock.patch('builtins.open', mock.mock_open(read_data=key_text)):
            tagged = _quiet(plb.tag_genres_ai, tracks)
        return tagged, create

    def test_explicit_cannot_classify_sets_5_only_from_state_1(self):
        tracks = self._candidates()
        tagged, create = self._run(tracks, reply='{"genre": null, "confident": false}')
        self.assertEqual(tagged, 0)
        self.assertEqual(create.call_count, 2)
        self.assertEqual(tracks[0]['open_genre'], 5)   # 1 → 5: the API really answered
        self.assertEqual(tracks[1]['open_genre'], 4)   # 4 stays 4: inherited beats nothing

    def test_unknown_genre_counts_as_answered(self):
        tracks = self._candidates()
        tagged, _ = self._run(tracks, reply='{"genre": "Jazz", "confident": true}')
        self.assertEqual(tagged, 0)
        self.assertEqual(tracks[0]['open_genre'], 5)
        self.assertEqual(tracks[1]['open_genre'], 4)

    def test_network_error_leaves_state_untouched(self):
        tracks = self._candidates()
        tagged, create = self._run(tracks, raises=ConnectionError('network down'))
        self.assertEqual(tagged, 0)
        self.assertEqual(create.call_count, 2)  # one failure must not abort the loop
        self.assertEqual(tracks[0]['open_genre'], 1)
        self.assertEqual(tracks[1]['open_genre'], 4)
        self.assertEqual(tracks[0]['genres_raw'], [])

    def test_malformed_reply_leaves_state_untouched(self):
        for reply in ('Sorry, I cannot tell.', '{"genre": broken}', ''):
            with self.subTest(reply=reply):
                tracks = self._candidates()
                tagged, _ = self._run(tracks, reply=reply)
                self.assertEqual(tagged, 0)
                self.assertEqual(tracks[0]['open_genre'], 1)
                self.assertEqual(tracks[1]['open_genre'], 4)

    def test_confident_answer_sets_2_with_canonical_genres_raw(self):
        tracks = self._candidates()
        tagged, _ = self._run(tracks, reply='{"genre": "Rock", "confident": true}')
        self.assertEqual(tagged, 2)
        for t in tracks:
            with self.subTest(track=t['id']):
                self.assertEqual(t['open_genre'], 2)
                self.assertEqual(t['genres_raw'], [plb._GENRE_CANONICAL['Rock']])
                self.assertEqual(t['genre'], 'Rock')
                self.assertEqual(t['decisive_genre'], plb._GENRE_CANONICAL['Rock'])
                self.assertEqual(t['bpmg'], 'D')

    def test_unconfident_allowed_genre_does_not_set_2(self):
        # the `confident` gate: an allowed genre with confident=false is a hedged guess, not a
        # find — it must never become state 2 (which merge() would then preserve on --rebuild)
        tracks = self._candidates()
        tagged, create = self._run(tracks, reply='{"genre": "Rock", "confident": false}')
        self.assertEqual(tagged, 0)
        self.assertEqual(create.call_count, 2)
        self.assertEqual(tracks[0]['open_genre'], 5)   # 1 → 5: the API answered, no find
        self.assertEqual(tracks[1]['open_genre'], 4)   # 4 stays 4
        self.assertEqual(tracks[0]['genres_raw'], [])
        self.assertEqual(tracks[1]['genres_raw'], ['alternative rock'])

    def test_only_states_1_and_4_are_sent_to_the_api(self):
        tracks = [_pool_track(f't{og}', 'Band A', og, ['alternative rock'])
                  for og in (0, 2, 3, 5, 6, 7)]
        tagged, create = self._run(tracks, reply='{"genre": "Rock", "confident": true}')
        self.assertEqual(tagged, 0)
        self.assertEqual(create.call_count, 0)
        self.assertEqual([t['open_genre'] for t in tracks], [0, 2, 3, 5, 6, 7])

    def test_inherited_genres_are_sent_as_prior(self):
        tracks = self._candidates()
        _, create = self._run(tracks, reply='{"genre": null, "confident": false}')
        prompt_t1 = create.call_args_list[0].kwargs['messages'][0]['content']
        prompt_t4 = create.call_args_list[1].kwargs['messages'][0]['content']
        self.assertNotIn('Geerbte Genres', prompt_t1)
        self.assertIn('Geerbte Genres', prompt_t4)
        self.assertIn('alternative rock', prompt_t4)

    def test_missing_or_empty_key_file_changes_nothing(self):
        for kwargs in ({'key_present': False}, {'key_text': ''}):
            with self.subTest(**kwargs):
                tracks = self._candidates()
                tagged, create = self._run(tracks, reply='{"genre": "Rock", "confident": true}',
                                           **kwargs)
                self.assertEqual(tagged, 0)
                self.assertEqual(create.call_count, 0)
                self.assertEqual([t['open_genre'] for t in tracks], [1, 4])

    def test_missing_anthropic_package_changes_nothing(self):
        tracks = self._candidates()
        tagged, _ = self._run(tracks, module_present=False)
        self.assertEqual(tagged, 0)
        self.assertEqual([t['open_genre'] for t in tracks], [1, 4])


if __name__ == '__main__':
    unittest.main()
