/**
 * One command for the owner's computer: download fresh CIAN offers, commit them and push.
 * The push triggers the GitHub Pages workflow, which rebuilds the site with the new data.
 *
 *   npm run update-data            # fetch + commit + push
 *   npm run update-data -- --no-push
 */
import { spawnSync } from 'node:child_process';

const noPush = process.argv.includes('--no-push');

function run(cmd: string, args: string[], allowFail = false): number {
  // shell: true so `npm` resolves to npm.cmd on Windows.
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  const code = res.status ?? 1;
  if (code !== 0 && !allowFail) {
    console.error(`\nКоманда не выполнилась: ${cmd} ${args.join(' ')}`);
    process.exit(code);
  }
  return code;
}

const fetched = run('npm', ['run', 'fetch:cian'], true);
if (fetched !== 0) {
  console.error('\nНе удалось скачать объявления, на сайт ничего не отправлено.');
  process.exit(1);
}

run('git', ['add', 'public/data']);
// `git diff --cached --quiet` exits 1 when there is something staged.
if (run('git', ['diff', '--cached', '--quiet', '--', 'public/data'], true) === 0) {
  console.log('\nНовых данных нет — отправлять нечего.');
  process.exit(0);
}
run('git', ['commit', '-m', `Update CIAN offers (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`, '--', 'public/data']);

if (noPush) {
  console.log('\nЗакоммичено. Отправьте на GitHub командой: git push');
} else {
  run('git', ['push']);
  console.log('\nОтправлено. Сайт обновится через 1–2 минуты (вкладка Actions → Deploy to GitHub Pages).');
}
