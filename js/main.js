// JavaScript が動いたことを CSS に伝える（フェードインの初期状態はこのクラスがあるときだけ付く）
document.documentElement.classList.add('js');

// スマートフォンの幅で開閉するメニュー
function initNavToggle() {
  const button = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!button || !nav) return;

  function isOpen() {
    return button.getAttribute('aria-expanded') === 'true';
  }

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  }

  button.addEventListener('click', () => {
    setOpen(!isOpen());
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  // Esc キーで閉じ、開閉ボタンにフォーカスを戻す
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    button.focus();
  });
}

// メニューで今見ている節を示し、カギ形の枠をその項目へ移す
function initNavCursor() {
  const nav = document.getElementById('site-nav');
  const header = document.querySelector('.site-header');
  if (!nav || !header) return;

  const cursor = nav.querySelector('.nav-cursor');
  // 左上、右上、左下、右下の順
  const corners = cursor ? [...cursor.querySelectorAll('.nav-cursor__corner')] : [];
  const items = [...nav.querySelectorAll('.site-nav__list a[href^="#"]')]
    .map((link) => ({ link, section: document.querySelector(link.getAttribute('href')) }))
    .filter((item) => item.section);
  if (!items.length) return;

  let currentIndex = -1;
  // メニューで選んだ節。ページの最後のほうの節は下端まで届くため、スクロールの位置だけでは決められない
  let chosenIndex = items.findIndex((item) => item.link.getAttribute('href') === window.location.hash);

  function findCurrentIndex() {
    if (chosenIndex >= 0) return chosenIndex;

    // ページの最後まで来たら、最後の節（各種サイトの節は短く、上端が基準の線まで届かないため）
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) return items.length - 1;

    // ヘッダーの下から画面の3割の位置を基準の線にし、それより上に始まった最後の節を今の節とする。
    // どの節もまだ線に届いていない（最初の画面を見ている）ときは -1
    const line = header.offsetHeight + window.innerHeight * 0.3;
    let index = -1;
    items.forEach((item, i) => {
      if (item.section.getBoundingClientRect().top <= line) index = i;
    });
    return index;
  }

  function moveCursor() {
    const link = items[currentIndex]?.link;
    if (!cursor || !link || corners.length !== 4) {
      cursor?.classList.toggle('is-hidden', !link);
      return;
    }
    // 位置と大きさを先にまとめて読み、そのあとで書き込む（読み書きを交互にすると、そのたびにレイアウトが計算し直される）
    const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } = link;
    const size = corners[0].offsetWidth;
    const right = left + width - size;
    const bottom = top + height - size;

    cursor.classList.remove('is-hidden');
    [[left, top], [right, top], [left, bottom], [right, bottom]].forEach(([x, y], i) => {
      corners[i].style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  function update(force = false) {
    const index = findCurrentIndex();
    if (index === currentIndex && !force) return;
    currentIndex = index;
    items.forEach((item, i) => {
      if (i === index) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    });
    moveCursor();
  }

  items.forEach((item, i) => {
    item.link.addEventListener('click', () => {
      chosenIndex = i;
      update();
    });
  });

  // 自分でスクロールし始めたら、メニューで選んだ節ではなくスクロールの位置で決める
  const releaseChoice = () => {
    if (chosenIndex < 0) return;
    chosenIndex = -1;
    update();
  };
  ['wheel', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, releaseChoice, { passive: true });
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  }, { passive: true });

  // 画面の幅やフォントが変わると項目の位置も変わるので、置き直す
  window.addEventListener('resize', () => update(true));
  document.fonts?.ready.then(() => update(true));

  update(true);
  // 最初の位置へは滑らせずに置き、そのあとから動きを付ける
  requestAnimationFrame(() => cursor?.classList.add('is-ready'));
}

function createValueLabel(text) {
  const label = document.createElement('span');
  label.className = 'skill__value';
  label.textContent = text;
  // 読み上げでは meter の値が伝わるので、見た目の数値は重ねて読ませない
  label.setAttribute('aria-hidden', 'true');
  return label;
}

// スキルのバーに数値の文字と読み上げ用の情報を付け、data-level の長さにする
function initSkillBars() {
  const bars = document.querySelectorAll('.skill-bar[data-level]');

  bars.forEach((bar) => {
    const level = Math.min(100, Math.max(0, Number(bar.dataset.level) || 0));
    const skill = bar.closest('.skill');
    const name = skill?.querySelector('.skill__name')?.textContent ?? 'スキル';
    const head = skill?.querySelector('.skill__head');

    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', `${name} の習熟度`);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(level));
    const lv = `Lv.${Math.round(level / 10)}`;
    bar.setAttribute('aria-valuetext', `${lv}（${level}%）`);

    if (head) {
      head.append(createValueLabel(lv));
    }

    bar.style.setProperty('--level', level);
  });
}

// data/steam-games.json（GitHub Actions が毎日 Steam から作る）を読む。
// トップ画面とゲームの節の両方で使うので、読み込みは1回だけにする
let steamGamesRequest;
function loadSteamGames() {
  steamGamesRequest ??= fetch('data/steam-games.json').then((response) => {
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
  });
  return steamGamesRequest;
}

// ストアの横長の画像（460×215）。ストアが返した URL を使い、古い JSON で入っていないときは決まった形の URL を試す。
// URL は CSS の url("…") にも埋めるので、Steam の画像の配信元のものだけを使い、URL の形に整えてから返す
// （整えると " などの記号が % の形になり、CSS の指定を崩せない）
const STEAM_IMAGE_ORIGIN = 'https://shared.akamai.steamstatic.com';
function steamHeaderImage(game) {
  const fallback = `${STEAM_IMAGE_ORIGIN}/store_item_assets/steam/apps/${Number(game.appid)}/header.jpg`;
  try {
    const url = new URL(game.headerImage);
    return url.origin === STEAM_IMAGE_ORIGIN ? url.href : fallback;
  } catch {
    return fallback;
  }
}

function steamStoreUrl(game) {
  return `https://store.steampowered.com/app/${game.appid}/`;
}

// プレイしたゲームの画像を、トップ画面で10秒ごとに切り替えて出す。順番はシャッフルし、1周するまで同じゲームは出さない。
// 広い画面では右側に画像と名前を出し、狭い画面ではキャッチコピーの後ろに画像を薄く敷く（css/base.css）
const TITLE_GAME_INTERVAL = 10000;
// フェードアウト・フェードインそれぞれの時間。css/base.css の --title-game-fade（0.8 秒）と合わせる
const TITLE_GAME_FADE = 800;

function initTitleGame() {
  const figure = document.querySelector('.title-screen__game');
  const copy = document.querySelector('.title-screen__copy');
  if (!figure) return;
  const link = figure.querySelector('.title-screen__game-link');
  const image = figure.querySelector('.title-screen__game-image');
  const name = figure.querySelector('.title-screen__game-name');

  let order = [];
  let index = -1;
  let shown = false;

  // マウスを乗せている間、キーボードで選んでいる間、タブが裏にある間は切り替えない
  let hovered = false;
  figure.addEventListener('pointerenter', () => { hovered = true; });
  figure.addEventListener('pointerleave', () => { hovered = false; });
  const isPaused = () => hovered || figure.contains(document.activeElement) || document.hidden;

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // 次の画像を先に読み込んでから、今の画像を消して入れ替える（読み込みの途中で空になる時間を作らない）
  function showNext() {
    if (!order.length) {
      // 1本も読み込めなかったときは、場所ごと消して文字だけのトップ画面にする
      if (!shown) figure.remove();
      return;
    }
    index = (index + 1) % order.length;
    const game = order[index];
    const src = steamHeaderImage(game);

    const preload = new Image();
    preload.addEventListener('load', () => {
      figure.classList.remove('is-loaded');
      copy?.classList.remove('has-game-image');
      setTimeout(() => {
        link.href = steamStoreUrl(game);
        // ストアページは外のサイトなので、新しいタブで開く（最初の #games へのリンクは同じタブのまま）
        link.target = '_blank';
        link.rel = 'noopener';
        link.setAttribute('aria-label', `${game.name}（Steam のストアページ）`);
        name.textContent = game.name;
        image.src = src;
        copy?.style.setProperty('--title-game-image', `url("${src}")`);
        figure.classList.add('is-loaded');
        copy?.classList.add('has-game-image');
        shown = true;
      }, shown ? TITLE_GAME_FADE : 0);
    }, { once: true });
    // 読み込めない画像のゲームは順番から外して、次のゲームを試す
    preload.addEventListener('error', () => {
      order.splice(index, 1);
      index -= 1;
      showNext();
    }, { once: true });
    preload.src = src;
  }

  loadSteamGames()
    .then((data) => {
      order = shuffle((Array.isArray(data.games) ? data.games : []).filter((game) => game.headerImage));
      showNext();

      // 動きを減らす設定のときは、切り替えずに最初の1本だけを出す
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setInterval(() => {
        if (order.length > 1 && !isPaused()) showNext();
      }, TITLE_GAME_INTERVAL);
    })
    .catch(() => figure.remove());
}

// トップ画面とプロフィールの節の間は、途中で止めずに送る。トップ画面が見えている間に下へスクロールしたら
// プロフィールの節の頭まで送ってトップ画面を画面の外に出し、そこから上へスクロールしたらページのいちばん上まで戻す
function initTitleScrollSnap() {
  const header = document.querySelector('.site-header');
  const profile = document.getElementById('profile');
  if (!header || !profile) return;

  // 送っている間と、送り終わってもひと続きのスクロールが止むまでは、届くホイールやスワイプを捨てる。
  // トラックパッドやマウスの慣性のスクロールは指を離したあとも届き続けるので、送り終わった時点で受け付けると、
  // トップ画面が外に出た位置で止まらずに先へ進んでしまう
  let moving = false;
  let arrived = false;
  let touching = false;
  let lastWheel = 0;
  // 慣性のホイールは数十 ms おきに届くので、これだけ途切れたらひと続きのスクロールが止んだとみなす
  const WHEEL_QUIET = 300;

  // 着いていて、指が離れていて、ホイールが途切れていたら受け付けを再開する
  function release() {
    if (!moving || !arrived || touching) return;
    const wait = lastWheel + WHEEL_QUIET - performance.now();
    if (wait > 0) {
      setTimeout(release, wait);
      return;
    }
    moving = false;
  }

  // プロフィールの節の頭の、ヘッダーの下の端からの位置。0 より大きければトップ画面がまだ見えている
  // （ヘッダーの高さは小数になることがあるので、1px の差はそろっているとみなす）
  const profileOffset = () => profile.getBoundingClientRect().top - header.offsetHeight;

  // 下へ送るのはトップ画面が見えているとき。上へ戻すのは、今のスクロールでプロフィールの節の頭より上に出るとき
  // （amount はそのスクロールで上へ動く量。下のほうから大きく戻したときに、境目を越えた所で止めない）
  function shouldSkip(down, amount) {
    const offset = profileOffset();
    return down ? offset > 1 : offset + amount > -2 && window.scrollY > 0;
  }

  function skip(event, down, amount = 0) {
    if (moving) {
      event.preventDefault();
      return;
    }
    if (!shouldSkip(down, amount)) return;
    event.preventDefault();
    moving = true;
    arrived = false;
    // ヘッダーの分は html の scroll-padding-top であける。動きを減らす設定では、CSS が滑らかなスクロールを止める
    if (down) profile.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
    const done = () => {
      if (arrived) return;
      arrived = true;
      release();
    };
    if ('onscrollend' in window) window.addEventListener('scrollend', done, { once: true });
    // scrollend がないブラウザと、すでに着いていてスクロールが起きないときのため
    setTimeout(done, 1000);
  }

  // ホイールの量は、行や画面の単位で届くこともあるので px に直す
  window.addEventListener('wheel', (event) => {
    lastWheel = performance.now();
    if (event.deltaY === 0) return;
    const unit = [1, 16, window.innerHeight][event.deltaMode] ?? 1;
    skip(event, event.deltaY > 0, -event.deltaY * unit);
  }, { passive: false });

  // スマートフォンでは、指を上へ動かすとページを下へ、下へ動かすと上へ送る。開いたメニューの中は除く
  let touchY = null;
  window.addEventListener('touchstart', (event) => {
    touching = true;
    touchY = event.target.closest('.site-nav') ? null : event.touches[0].clientY;
  }, { passive: true });
  // 送ったあとも指を動かし続けていたら、指を離すまで受け付けない
  ['touchend', 'touchcancel'].forEach((type) => {
    window.addEventListener(type, (event) => {
      if (event.touches.length) return;
      touching = false;
      release();
    }, { passive: true });
  });
  window.addEventListener('touchmove', (event) => {
    if (touchY === null) return;
    const distance = touchY - event.touches[0].clientY;
    if (moving || Math.abs(distance) > 10) skip(event, distance > 0, -distance);
  }, { passive: false });

  // 入力欄や選択肢、ボタンの上では、キーをその部品に任せる
  window.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select, button')) return;
    const down = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey);
    const up = ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey);
    // 上へ動く量は、↑ならブラウザの1回分（40px ほど）、PageUp やスペースなら画面の高さほど
    if (down || up) skip(event, down, event.key === 'ArrowUp' ? 40 : window.innerHeight);
  });
}

// プレイしたゲームの一覧。data/steam-games.json を読み、選んだ順に並べる
function initSteamGames() {
  const list = document.getElementById('games-list');
  const summary = document.getElementById('games-summary');
  const select = document.getElementById('games-sort');
  if (!list || !summary || !select) return;

  const hours = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' });
  // 最終プレイは日本時間の日付（2026-10-22 の形）で届く。見る人の時差で日付がずれないよう、UTC の 0 時として出す
  const playedDate = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'UTC' });
  // 名前の中の数字は数として比べる（「2」を「10」より前にする）
  const collator = new Intl.Collator('ja', { numeric: true });

  // 並べ替えの順。同じ値のときはプレイ時間の長い順にする
  const byPlaytime = (a, b) => b.playtimeForever - a.playtimeForever;
  const compare = {
    playtime: byPlaytime,
    // 日付の文字列は、そのまま比べると日付の順になる。同じ日に遊んだゲームはプレイ時間の長い順
    recent: (a, b) => (b.lastPlayedDate ?? '').localeCompare(a.lastPlayedDate ?? '') || byPlaytime(a, b),
    name: (a, b) => collator.compare(a.name, b.name),
    twoWeeks: (a, b) => b.playtime2Weeks - a.playtime2Weeks || byPlaytime(a, b),
  };

  function createCard(game) {
    const link = document.createElement('a');
    link.className = 'game-card';
    link.href = steamStoreUrl(game);
    // 外のサイト（Steam のストア）へのリンクは、新しいタブで開く
    link.target = '_blank';
    link.rel = 'noopener';

    // 名前は横に文字で出すので、画像は読み上げない
    const image = document.createElement('img');
    image.className = 'game-card__image';
    image.alt = '';
    image.width = 460;
    image.height = 215;
    // loading は src より先に決める。先に src を入れると、ページに置く前に読み込みが始まり、
    // 「もっとみる」で隠しているゲームの画像まで最初に読んでしまう
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = steamHeaderImage(game);
    // 画像のないゲームは、画像の場所を消して名前だけにする
    image.addEventListener('error', () => image.remove(), { once: true });

    const body = document.createElement('div');
    body.className = 'game-card__body';

    const name = document.createElement('p');
    name.className = 'game-card__name';
    name.translate = false;
    name.textContent = game.name;

    const meta = [`合計 ${hours.format(game.playtimeForever / 60)} 時間`];
    if (game.playtime2Weeks > 0) meta.push(`最近2週間 ${hours.format(game.playtime2Weeks / 60)} 時間`);
    if (game.lastPlayedDate) meta.push(`最終プレイ ${playedDate.format(new Date(`${game.lastPlayedDate}T00:00:00Z`))}`);
    const metaLines = meta.map((text) => {
      const line = document.createElement('p');
      line.className = 'game-card__meta';
      line.textContent = text;
      return line;
    });

    body.append(name, ...metaLines);
    link.append(image, body);

    const item = document.createElement('li');
    item.append(link);
    return item;
  }

  const moreWrap = document.querySelector('.games__more-wrap');
  const moreButton = moreWrap?.querySelector('.games__more');

  let games = [];
  let expanded = false;

  // 閉じている間は1行目のカードだけを出す。1行に並ぶ数は画面の幅で変わるので、グリッドの列の数を数える
  function applyLimit() {
    // 列の数は、閉じた状態の並びで数える。開くと一覧の中にスクロールバーが出て幅が狭くなるが、
    // 同じ列の数のままカードを少し狭めて並べる（css/base.css の .games.is-expanded）
    // 数えるために一度閉じた形に戻すと一覧の中のスクロール位置が消えるので、覚えておいて戻す
    const scrollTop = list.scrollTop;
    list.classList.remove('is-expanded');
    const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length;
    list.style.setProperty('--games-columns', columns);
    list.classList.toggle('is-expanded', expanded);
    list.scrollTop = expanded ? scrollTop : 0;

    const items = [...list.children];
    items.forEach((item, i) => {
      item.hidden = !expanded && i >= columns;
    });

    const rest = items.length - columns;
    if (!moreWrap || !moreButton) return;
    moreWrap.hidden = rest <= 0;
    moreButton.setAttribute('aria-expanded', String(expanded));
    moreButton.textContent = expanded ? '閉じる' : `もっとみる（残り ${rest} 本）`;
  }

  function render() {
    const sorted = [...games].sort(compare[select.value] ?? byPlaytime);
    list.replaceChildren(...sorted.map(createCard));
    applyLimit();
  }

  select.addEventListener('change', render);

  moreButton?.addEventListener('click', () => {
    expanded = !expanded;
    applyLimit();
  });

  // 画面の幅が変わると1行に並ぶ数も変わるので、出すカードを選び直す
  window.addEventListener('resize', () => {
    if (games.length) applyLimit();
  });

  // 読み込み中の骨組み（index.html）を外す。カードがあるときは render が入れ替え、「もっとみる」も applyLimit が決める
  function finishLoading() {
    list.removeAttribute('aria-busy');
    if (games.length) return;
    list.replaceChildren();
    if (moreWrap) moreWrap.hidden = true;
  }

  loadSteamGames()
    .then((data) => {
      games = Array.isArray(data.games) ? data.games : [];
      finishLoading();
      if (!games.length) {
        summary.textContent = 'まだゲームの記録がありません。';
        select.disabled = true;
        return;
      }
      const updated = data.updatedAt ? `（${date.format(new Date(data.updatedAt))} 時点）` : '';
      summary.textContent = `Steam で2時間以上遊んだゲーム ${games.length} 本${updated}`;
      render();
    })
    .catch(() => {
      finishLoading();
      summary.textContent = 'ゲームの一覧を読み込めませんでした。時間をおいて、ページを読み込み直してください。';
      select.disabled = true;
    });
}

// お問い合わせフォーム。ページを移らずに Formspree へ送り、結果をフォームの下に出す
// （JavaScript が動かないときは、ふつうのフォームとして送られ、Formspree の完了ページに移る）
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const button = form.querySelector('.contact-form__submit');
  const status = form.querySelector('.contact-form__status');
  const firstInput = form.querySelector('.contact-form__input');

  // 「お問い合わせ」のリンクを押したら、スクロールしたうえで最初の入力欄を選んだ状態にする。
  // リンク先への移動が済んでから選ばないと、移動のときにフォーカスが外れる
  document.querySelectorAll('a[href="#contact-form"]').forEach((link) => {
    link.addEventListener('click', () => {
      setTimeout(() => firstInput?.focus({ preventScroll: true }), 0);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    // 送信中は二度送らない。disabled にすると押したボタンからフォーカスが外れるので、aria-disabled で示す
    if (button.getAttribute('aria-disabled') === 'true') return;
    button.setAttribute('aria-disabled', 'true');
    status.textContent = '送信しています…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      form.reset();
      status.textContent = '送信しました。お問い合わせありがとうございます。';
    } catch {
      status.textContent = '送信できませんでした。時間をおいて、もう一度お試しください。';
    } finally {
      button.removeAttribute('aria-disabled');
    }
  });
}

// ページ内リンクで移動したあと、アドレスバーの URL から #… を消す。
// 移動そのものはブラウザに任せる（スクロールとフォーカスの移り先がふつうのリンクと同じになる）
function initCleanHash() {
  const clean = () => {
    if (!window.location.hash) return;
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
  };
  window.addEventListener('hashchange', clean);
  // # の付いた URL で開いたときも、その位置へ移ったあとで消す
  window.addEventListener('load', clean);
}

initNavToggle();
initNavCursor();
initSkillBars();
initTitleGame();
initTitleScrollSnap();
initSteamGames();
initContactForm();
initCleanHash();
