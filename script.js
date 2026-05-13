// supabase 初始化
const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
const db = supabase.createClient(supabaseUrl, supabaseKey);

const voteForm = document.getElementById('voteForm');
const submitBtn = document.getElementById('submitBtn');

// 页面加载时获取候选人并生成表单
async function loadCandidates() {
  const { data: candidates, error } = await db
    .from('candidates')
    .select('*')
    .order('position', { ascending: true });
    console.log(candidates);
    console.log(error);

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
let submitting = false;

async function submitVote() {

  // 防止连续点击
  if (submitting) return;

  submitting = true;

  try {

    // 获取序列码
    const userCode =
      document.getElementById('userCode')
      .value
      .trim()
      .toUpperCase();

    // 检查序列码
    if (!userCode || userCode.length !== 5) {

      alert("请输入正确的5位序列码");

      submitting = false;

      return;

    }

    // 验证序列码
    const { data: codeData, error: codeError } =
      await db
        .from('codes')
        .select('*')
        .eq('code', userCode)
        .single();

    if (codeError || !codeData) {

      alert("序列码无效");

      submitting = false;

      return;

    }

    // 检查是否已使用
    if (codeData.used) {

      alert("该序列码已使用");

      submitting = false;

      return;

    }

    // 获取所有岗位
    const positions =
      document.querySelectorAll('.position');

    // 完整校验
    for (const div of positions) {

      const title =
        div.querySelector('h2').textContent;

      const inputs =
        div.querySelectorAll('input');

      if (inputs.length === 0) continue;

      let maxSelect = 1;

      const match =
        title.match(/选(\d+)人/);

      if (match) {

        maxSelect =
          parseInt(match[1]);

      }

      const checked =
        div.querySelectorAll('input:checked');

      // 单选
      if (maxSelect === 1) {

        if (checked.length !== 1) {

          alert(`${title} 必须选择1人`);

          submitting = false;

          return;

        }

      }

      // 多选
      else {

        if (checked.length !== maxSelect) {

          alert(
            `${title} 必须选择 ${maxSelect} 人`
          );

          submitting = false;

          return;

        }

      }

    }

    // 收集投票数据
    const voteArray = [];

    positions.forEach(div => {

      const checkedInputs =
        div.querySelectorAll('input:checked');

      checkedInputs.forEach(input => {

        voteArray.push({

          user_code: userCode,

          candidate_id:
            parseInt(input.value)

        });

      });

    });

    // 插入投票
    const { error: voteError } =
      await db
        .from('votes')
        .insert(voteArray);

    if (voteError) {

      alert(
        "投票失败："
        + voteError.message
      );

      submitting = false;

      return;

    }

    // 更新序列码状态
    const { error: updateError } =
      await db
        .from('codes')
        .update({

          used: true

        })
        .eq('code', userCode)
        .eq('used', false);

    if (updateError) {

      alert(
        "更新序列码状态失败："
        + updateError.message
      );

      submitting = false;

      return;

    }

    // 投票成功
    alert("投票成功");

    // 尝试关闭网页（手机端）
    window.open('', '_self');

    window.close();

    // 如果浏览器不允许关闭
    // 自动跳转空白页
    setTimeout(() => {

      location.href = 'about:blank';

    }, 500);

  }

  catch (err) {

    console.error(err);

    alert("系统错误：" + err.message);

  }

  finally {

    submitting = false;

  }

}