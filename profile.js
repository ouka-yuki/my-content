const supabaseClient = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseKey
);

const CATEGORY_LABELS = {
    sci_math:      '理学',
    engineering:   '工学',
    info_data:     '情報・データ',
    agri_bio:      '農学・生物',
    medical:       '医療・福祉',
    sports_health: 'スポーツ・健康',
    education:     '教育・心理',
    business:      '社会科学',
    humanities:    '人文・文化',
    intl_lang:     '国際・語学',
    arts_create:   '芸術・創造'
};

function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast toast-' + (type || 'success') + ' toast-show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('toast-show'), 3000);
}

async function loadProfile(user) {
    document.getElementById('auth-gate').classList.add('hidden');
    document.getElementById('profile-content').classList.remove('hidden');

    const email = user.email || '';
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('user-email').textContent = email;
    document.getElementById('user-avatar').textContent = email.charAt(0).toUpperCase();
    document.getElementById('profile-email').textContent = email;

    // プロフィール取得 / 作成
    const { data: profile } = await supabaseClient
        .from('profiles').select('*').eq('id', user.id).maybeSingle();

    if (profile) {
        const nick = profile.nickname || '未設定';
        document.getElementById('profile-nickname-display').textContent = nick;
        document.getElementById('profile-avatar-large').textContent =
            nick !== '未設定' ? nick.charAt(0).toUpperCase() : email.charAt(0).toUpperCase();
        document.getElementById('nickname-input').value = profile.nickname || '';
    } else {
        const nickname = user.user_metadata?.name || user.user_metadata?.full_name || '';
        await supabaseClient.from('profiles').insert({ id: user.id, nickname });
        document.getElementById('profile-nickname-display').textContent = nickname || '未設定';
        document.getElementById('profile-avatar-large').textContent = email.charAt(0).toUpperCase();
        document.getElementById('nickname-input').value = nickname;
    }

    // 診断結果取得
    const { data: diagResults, error: diagErr } = await supabaseClient
        .from('diagnosis_results')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (diagErr) {
        document.getElementById('no-diagnosis').textContent = 'データの取得に失敗しました: ' + diagErr.message;
    } else if (diagResults && diagResults.length > 0) {
        const result = diagResults[0];
        document.getElementById('no-diagnosis').style.display = 'none';
        const grid = document.getElementById('diagnosis-display');
        const rankLabels = ['TOP 1', 'TOP 2', 'TOP 3'];
        [result.top1, result.top2, result.top3].forEach((cat, i) => {
            if (!cat) return;
            const card = document.createElement('div');
            card.className = 'diagnosis-rank-card glass-panel';
            card.innerHTML = `
                <div class="rank-badge">${rankLabels[i]}</div>
                <h4 style="margin-top:0.75rem;font-size:1.1rem;">${CATEGORY_LABELS[cat] || cat}</h4>
            `;
            grid.appendChild(card);
        });
    }

    // 保存記事取得
    const { data: articles, error: articlesErr } = await supabaseClient
        .from('saved_articles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    const savedCount = (articles || []).length;
    document.getElementById('saved-count').textContent = savedCount;

    if (articlesErr) {
        document.getElementById('no-saved-articles').textContent = 'データの取得に失敗しました: ' + articlesErr.message;
    } else if (articles && articles.length > 0) {
        document.getElementById('no-saved-articles').style.display = 'none';
        const grid = document.getElementById('saved-articles-grid');
        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'saved-article-card glass-panel';
            card.innerHTML = `
                <div class="saved-article-header">
                    <span class="badge">${CATEGORY_LABELS[article.category] || article.category}</span>
                    <button class="delete-saved-btn" data-id="${article.id}" title="保存を削除">✕</button>
                </div>
                <h4 style="font-size:0.95rem;margin:0.5rem 0;">${article.article_title}</h4>
                <p class="article-summary" style="flex:1;">${article.article_desc || ''}</p>
                ${article.article_url
                    ? `<a href="${article.article_url}" target="_blank" rel="noopener noreferrer"
                          class="btn btn-primary" style="display:inline-block;margin-top:1rem;font-size:0.85rem;padding:0.5rem 1rem;">
                          🔍 詳しく調べる
                       </a>`
                    : ''}
            `;
            card.querySelector('.delete-saved-btn').addEventListener('click', async (e) => {
                if (!confirm('この記事の保存を削除しますか？')) return;
                const { error } = await supabaseClient
                    .from('saved_articles').delete().eq('id', e.target.dataset.id);
                if (!error) {
                    card.remove();
                    const newCount = parseInt(document.getElementById('saved-count').textContent) - 1;
                    document.getElementById('saved-count').textContent = newCount;
                    if (newCount === 0) document.getElementById('no-saved-articles').style.display = '';
                    showToast('保存を削除しました。');
                }
            });
            grid.appendChild(card);
        });
    }
}

// ニックネーム編集
document.getElementById('edit-nickname-btn').addEventListener('click', () => {
    document.getElementById('nickname-edit-form').classList.toggle('hidden');
});

document.getElementById('cancel-nickname-btn').addEventListener('click', () => {
    document.getElementById('nickname-edit-form').classList.add('hidden');
});

document.getElementById('save-nickname-btn').addEventListener('click', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const nickname = document.getElementById('nickname-input').value.trim();
    const { error } = await supabaseClient
        .from('profiles').update({ nickname }).eq('id', session.user.id);
    if (!error) {
        document.getElementById('profile-nickname-display').textContent = nickname || '未設定';
        const avatarEl = document.getElementById('profile-avatar-large');
        avatarEl.textContent = nickname
            ? nickname.charAt(0).toUpperCase()
            : session.user.email.charAt(0).toUpperCase();
        document.getElementById('nickname-edit-form').classList.add('hidden');
        showToast('ニックネームを更新しました！');
    }
});

// ログアウト
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '/';
});

// 認証状態の監視
supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session) {
        document.getElementById('auth-gate').classList.remove('hidden');
        document.getElementById('profile-content').classList.add('hidden');
        document.getElementById('user-info').classList.add('hidden');
    }
});

supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
        loadProfile(session.user);
    } else {
        document.getElementById('auth-gate').classList.remove('hidden');
    }
});
