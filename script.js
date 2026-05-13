// Supabase 初始化
const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
const supabase = Supabase.createClient(supabaseUrl, supabaseKey);

const voteForm = document.getElementById('voteForm');
const submitBtn = document.getElementById('submitBtn');

// 页面加载时获取候选人并生成表单
async function loadCandidates() {
  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    alert("加载候选人失败：" + error.message);
    return;
  }

  // 按岗位分组
  const groups = {};
  candidates.forEach(c => {
    if (!groups[c.position]) groups[c.position] = [];
    groups[c.position].push(c);
  });

  // 生成 HTML
  for (const [position, list] of Object.entries(groups)) {
    const div = document.createElement('div');
    div.className = 'position';
    const maxSelect = list[0].max_select || 1;
    const title = document.createElement('h2');
    title.textContent = `${position}（选${maxSelect}人）`;
    div.appendChild(title);

list.forEach(c => {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = maxSelect === 1 ? 'radio' : 'checkbox';
  input.name = position;
  input.value = c.id;

  // 复选框限制选择人数
  if (maxSelect > 1) {
    input.addEventListener('change', () => {
      const checked = document.querySelectorAll(
        `input[name="${position}"]:checked`
      );
      if (checked.length > maxSelect) {
        input.checked = false;
        alert(`${position} 最多只能选择 ${maxSelect} 人`);
      }
    });
  }
  label.appendChild(input);
  label.appendChild(
    document.createTextNode(' ' + c.name)
  );
  div.appendChild(label);
});
    voteForm.appendChild(div);
  }
}

// 提交投票
async function submitVote() {
  const userCode = document.getElementById('userCode').value.trim().toUpperCase();
// 获取所有岗位区域
const positions = document.querySelectorAll('.position');
// 检查每个岗位
for (const div of positions) {
  // 岗位名称
  const title = div.querySelector('h2').textContent;
  // 获取所有 input
  const inputs = div.querySelectorAll('input');
  if (inputs.length === 0) continue;
  // 最大选择人数
  const firstInput = inputs[0];
  let maxSelect = 1;
  // 从标题提取数字
  const match = title.match(/选(\d+)人/);
  if (match) {
    maxSelect = parseInt(match[1]);
  }
  // 已选择数量
  const checked = div.querySelectorAll('input:checked');
  // 单选岗位
  if (maxSelect === 1) {
    if (checked.length !== 1) {
      alert(`${title} 必须选择 1 人`);
      return;
    }
  }
  // 多选岗位
  else {
    if (checked.length !== maxSelect) {
      alert(`${title} 必须选择 ${maxSelect} 人`);
      return;
    }
  }
}

  if (!userCode || userCode.length !== 5) { alert("请输入正确的序列码"); return; }

  // 验证序列码
  const { data: codeData } = await supabase
    .from('codes')
    .select('*')
    .eq('code', userCode)
    .single();

  if (!codeData) { alert("序列码无效"); return; }
  if (codeData.used) { alert("序列码已使用"); return; }

  // 获取表单数据
  const formData = new FormData(voteForm);
  const voteArray = [];
  for (const [position, values] of formData.entries()) {
    if (Array.isArray(values)) {
      values.forEach(v => voteArray.push({ user_code: userCode, candidate_id: v }));
    } else {
      voteArray.push({ user_code: userCode, candidate_id: values });
    }
  }

  // 插入投票记录
  const { error: voteError } = await supabase
    .from('votes')
    .insert(voteArray);

  if (voteError) { alert("投票失败：" + voteError.message); return; }

  // 标记序列码为已使用
  const { error: updateError } = await supabase
    .from('codes')
    .update({ used: true })
    .eq('code', userCode);

  if (updateError) { alert("更新序列码状态失败：" + updateError.message); return; }

  alert("投票成功！");
  voteForm.reset();
  document.getElementById('userCode').value = '';
}

// 页面加载
window.addEventListener('DOMContentLoaded', loadCandidates);
submitBtn.addEventListener('click', submitVote);