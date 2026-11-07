"""Development-only Unslop audit/validation. Never imported by the application."""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--skill', type=pathlib.Path, default=pathlib.Path.home() / '.agents/skills/unslop')
args = parser.parse_args()
scripts = args.skill / 'scripts'
if not (scripts / 'validate_preservation.py').exists():
    raise SystemExit('Install Unslop before running this development audit.')
folder = ROOT / '.local/qa/ux/copy'
folder.mkdir(parents=True, exist_ok=True)
edits = json.loads((ROOT / 'docs/ux/COPY_CHANGES.json').read_text(encoding='utf8'))
results = []
for edit in edits:
    original = folder / (edit['id'] + '-before.txt')
    transformed = folder / (edit['id'] + '-after.txt')
    original.write_text(edit['before'], encoding='utf8')
    transformed.write_text(edit['after'], encoding='utf8')
    report = {'id': edit['id'], 'reason': edit['reason'], 'checks': {}}
    commands = {
        'preservation': ['validate_preservation.py', str(original), str(transformed)],
        'phrases': ['banned_phrase_scan.py', str(transformed)],
        'structure': ['structure_scan.py', str(transformed)],
        'silhouette': ['silhouette_scan.py', str(transformed)],
        'readability': ['readability_metrics.py', str(transformed)],
        'diff': ['diff_check.py', str(original), str(transformed)],
    }
    for key, command in commands.items():
        run = subprocess.run([sys.executable, str(scripts / command[0]), *command[1:]], capture_output=True, text=True, encoding='utf8')
        try:
            output = json.loads(run.stdout)
        except ValueError:
            output = {'stdout': run.stdout, 'stderr': run.stderr}
        report['checks'][key] = {'exit_code': run.returncode, 'report': output}
    results.append(report)

# Safety and operational qualifiers are deliberately outside the rewrite set.
protected = [
    'Physical lock position is not sensed.',
    'The controller normally relocks after about 5 seconds. Network failures can delay relocking.',
    'Uncalibrated reading. Use an independent gas alarm.',
    'Last movement report; not proof of absence.',
    'UID cards can be cloned. Only an owner can manage access.',
    'Acknowledging does not clear the sensor warning.',
    'Audio travels only to your home hub for local processing. It is not saved by default.',
    'No cloud inference. No default audio recording. Theme and accessibility preferences stay in this browser.',
]
source = (ROOT / 'public/js/views.js').read_text(encoding='utf8') + (ROOT / 'public/js/main.js').read_text(encoding='utf8')
preserved = {text: text in source for text in protected}
strict_checks = []
for i, text in enumerate(protected):
    file = folder / ('protected-' + str(i) + '.txt')
    file.write_text(text, encoding='utf8')
    run = subprocess.run([sys.executable, str(scripts / 'validate_preservation.py'), '--strict', str(file), str(file)], capture_output=True, text=True, encoding='utf8')
    strict_checks.append({'message': text, 'exit_code': run.returncode, 'report': json.loads(run.stdout)})
output = {'edits': results, 'protected_copy_present_verbatim': preserved, 'strict_protected_checks': strict_checks, 'limits': 'Scanners are English-oriented and advisory on short UI fragments; Hindi is reviewed separately.'}
(folder / 'validation.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf8')
failed = [r['id'] for r in results if r['checks']['preservation']['exit_code'] != 0]
print(json.dumps({'edits': len(results), 'preservation_failures': failed, 'protected_messages': sum(preserved.values()), 'protected_total': len(protected)}, ensure_ascii=False))
if failed or not all(preserved.values()) or any(r['exit_code'] for r in strict_checks):
    raise SystemExit(1)
