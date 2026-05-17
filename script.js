const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const submitBtn = document.getElementById('submitVote');

submitBtn.addEventListener('click', async () => {
  let submitting = true;

  // 获取所有岗位组
  const positions = document.querySelectorAll('.candidate-group');

  for (const div of positions) {
    const title = div.querySelector('h2') ? div.querySelector('h2').textContent : '岗位';
    const inputs = div.querySelectorAll('input');

    if (inputs.length === 0) continue;

    // 每个岗位最大可选人数
    let maxSelect = parseInt(div.dataset.max) || 1;

    // 已选数量
    const checked = div.querySelectorAll('input:checked');

    // 超选禁止提交
    if (checked.length > maxSelect) {
      alert(`${title} 最多只能选择 ${maxSelect} 人`);
      submitting = false;
      return;
    }

    // 少选提示（允许不选）
    if (checked.length < maxSelect) {
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

  // 提交投票逻辑（示例）
  const votesData = [];

  positions.forEach((div) => {
    const selected = div.querySelectorAll('input:checked');
    selected.forEach((input) => {
      votesData.push({
        candidate_id: input.value,
        code: document.getElementById('codeInput').value
      });
    });
  });

  try {
    const { data, error } = await supabase.from('votes').insert(votesData);
    if (error) throw error;
    alert('投票成功！');
    // 可以在这里锁定序列号或刷新页面
  } catch (err) {
    console.error(err);
    alert('投票失败，请重试');
  }
});