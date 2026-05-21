// =========================
// 页面初始化（确保 DOM 加载完成）
// =========================
document.addEventListener('DOMContentLoaded', () => {
  // 二维码 code 自动填充
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  console.log("二维码 code =", code);
  if (code) {
    const input = document.getElementById('userCode');
    if (input) {
      input.value = code.toUpperCase();
    }
    const userCodeDiv = document.querySelector('.user-code');
    if (userCodeDiv) {
      userCodeDiv.style.display = 'none';
    }
  }
  
  // 初始化 Supabase（确保库已加载）
  if (typeof supabase !== 'undefined') {
    initSupabase();
    loadCandidates();
  } else {
    console.error('❌ Supabase 库未加载，请检查是否引入脚本');
    alert('系统初始化失败，请刷新页面重试');
  }
});

// =========================
// Supabase 初始化（独立函数）
// =========================
function initSupabase() {
  const supabaseUrl = 'https://bhilewmilbhxowxwwyfq.supabase.co';
  const supabaseKey = 'sb_publishable_Qnzwloea8NOgqdtkhDVUEw_g_iIPMcD';
  window.db = supabase.createClient(supabaseUrl, supabaseKey);
}

// =========================
// 加载候选人（修复空格错误）
// =========================
async function loadCandidates() {
  const { data: candidates, error } = await window.db
    .from('candidates')
    .select('*')
    .order('position', { ascending: true });
    
  if (error) {
    alert("加载候选人失败：" + error.message);
    return;
  }
  
  const voteForm = document.getElementById('voteForm');
  if (!voteForm) return;
  
  // 按岗位分组
  const groups = {};
  candidates.forEach(c => {
    if (!groups[c.position]) groups[c.position] = [];
    groups[c.position].push(c);
  });
  
  // 生成岗位 DOM
  for (const [position, list] of Object.entries(groups)) {
    const div = document.createElement('div');
    div.className = 'position';
    const maxSelect = list[0].max_select || 1;
    div.dataset.maxSelect = maxSelect;

    const title = document.createElement('h2');
    title.textContent = `${position}（限选${maxSelect}人，可少选）`;
    div.appendChild(title);

    list.forEach(c => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = maxSelect === 1 ? 'radio' : 'checkbox';
      input.name = `pos_${position.replace(/\s+/g, '_')}`;
      input.value = c.id;

      if (maxSelect > 1) {
        input.addEventListener('change', () => {
          const checked = div.querySelectorAll('input:checked');
          if (checked.length > maxSelect) {
            input.checked = false;
            alert(`${position} 最多只能选择 ${maxSelect} 人`);
          }
        });
      }

      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + c.name));
      div.appendChild(label);
    });

    voteForm.appendChild(div);
  }
}

// =========================
// 提交投票（修复所有空格错误）
// =========================
async function submitVote() {
  const submitBtn = document.getElementById('submitBtn');
  if (!submitBtn || submitBtn.disabled) return;
  
  let submitting = false;
  if (submitting) return;
  submitting = true;
  submitBtn.disabled = true;
  
  try {
    const userCode = document.getElementById('userCode')?.value.trim().toUpperCase();
    
    // 校验序列码
    if (!userCode || userCode.length !== 5 || !/^[A-Z0-9]{5}$/.test(userCode)) {
      alert("请输入正确的5位序列码（字母+数字）");
      submitting = false;
      submitBtn.disabled = false;
      return;
    }

    // 验证序列码有效性
    const { data: codeData, error: codeError } = await window.db
      .from('codes')
      .select('*')
      .eq('code', userCode)
      .single();

    if (codeError || !codeData) {
      alert("序列码无效，请检查后重试");
      submitting = false;
      submitBtn.disabled = false;
      return;
    }
    if (codeData.used) {
      alert("该序列码已使用，请勿重复投票");
      submitting = false;
      submitBtn.disabled = false;
      return;
    }

    // 收集投票数据
    const positions = document.querySelectorAll('.position');
    const unselectedPositions = [];
    const voteArray = [];

    for (const div of positions) {
      const maxSelect = parseInt(div.dataset.maxSelect || 1);
      const titleEl = div.querySelector('h2');
      const positionName = titleEl?.textContent.split('（')[0].trim(); // ✅ 修复 trim()
      const checkedInputs = div.querySelectorAll('input:checked');

      if (checkedInputs.length > maxSelect) {
        alert(`${positionName} 最多只能选择 ${maxSelect} 人`);
        submitting = false;
        submitBtn.disabled = false;
        return;
      }

      if (checkedInputs.length === 0) {
        unselectedPositions.push(positionName); // ✅ 修复变量名
      } else {
        checkedInputs.forEach(input => { // ✅ 修复 =>
          voteArray.push({
            user_code: userCode,
            candidate_id: parseInt(input.value)
          });
        });
      }
    }

    // 少选确认
    if (unselectedPositions.length > 0) {
      const msg = `⚠️ 提示：您尚未选择以下岗位：\n${unselectedPositions.join('、')}\n\n✅ 确定 = 直接提交（未选项弃权）\n🔙 取消 = 返回补选`;
      if (!confirm(msg)) {
        submitting = false;
        submitBtn.disabled = false;
        return; // ✅ 修复 return
      }
    }

    // 写入投票
    if (voteArray.length > 0) {
      const { error: voteError } = await window.db.from('votes').insert(voteArray);
      if (voteError) throw voteError;
    }

    // 锁定序列码
    const { error: updateError } = await window.db
      .from('codes')
      .update({ used: true })
      .eq('code', userCode) // ✅ 修复 userCode
      .eq('used', false);

    if (updateError) throw updateError;

    // 显示成功
    const overlay = document.getElementById('successOverlay');
    if (overlay) overlay.style.display = 'flex';
    
    window.closePage = function() {
      if (overlay) overlay.style.display = 'none';
      setTimeout(() => { // ✅ 修复 =>
        window.location.href = 'about:blank';
      }, 500);
    };

  } catch (err) {
    console.error("投票异常:", err);
    alert("提交失败：" + err.message);
  } finally {
    submitting = false;
    if (submitBtn) submitBtn.disabled = false;
  }
}

// =========================
// 事件绑定（安全检查元素存在）
// =========================
document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitVote);
  }
  
  const resetBtn = document.getElementById('resetVotesBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('确定要复位所有投票数据？此操作不可恢复！')) return;
      // ... 复位逻辑（保持原样，注意修复空格）
      alert('复位功能需后端权限，请联系管理员');
    });
  }
});