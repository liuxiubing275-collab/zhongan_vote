// 防止重复声明 supabase
if (typeof supabase === 'undefined') {
    const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
    const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
    window.supabase = supabase.createClient(supabaseUrl, supabaseKey);
}

// 获取提交按钮
const submitBtn = document.getElementById('submitVote');

submitBtn.addEventListener('click', async () => {
    let submitting = true;

    // 获取所有岗位组
    const positions = document.querySelectorAll('.candidate-group');

    for (const div of positions) {
        const titleEl = div.querySelector('h2');
        const title = titleEl ? titleEl.textContent : '岗位';
        const inputs = div.querySelectorAll('input');

        if (inputs.length === 0) continue;

        // 每个岗位最大可选人数
        let maxSelect = parseInt(div.dataset.max) || 1;

        // 已选数量
        let checkedCount = 0;
        inputs.forEach(input => {
            if (input.checked) checkedCount++;
        });

        // 超选禁止提交
        if (checkedCount > maxSelect) {
            alert(`${title} 最多只能选择 ${maxSelect} 人`);
            submitting = false;
            return;
        }

        // 少选提示（允许不选）
        if (checkedCount < maxSelect) {
            const confirmSubmit = confirm(
                `岗位 "${title}" 您未选择所有候选人，是否仍然提交？点击确定直接提交，点击取消返回补选`
            );
            if (!confirmSubmit) {
                submitting = false;
                return; // 返回补选
            }
        }
    }

    if (!submitting) return;

    // 构造投票数据
    const votesData = [];
    positions.forEach(div => {
        const inputs = div.querySelectorAll('input');
        inputs.forEach(input => {
            if (input.checked) {
                votesData.push({
                    candidate_id: input.value,
                    code: document.getElementById('codeInput').value
                });
            }
        });
    });

    // 提交到 Supabase
    try {
        const { data, error } = await supabase.from('votes').insert(votesData);
        if (error) throw error;
        alert('投票成功！');
        // 可在此刷新页面或锁定序列号
    } catch (err) {
        console.error(err);
        alert('投票失败，请重试');
    }
});