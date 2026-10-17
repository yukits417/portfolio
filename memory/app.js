/* ====================================================
   艾宾浩斯复习助手 (Ebbinghaus Memory Master)
   App Logic: Ebbinghaus Algorithm, Voice Input, Duolingo Mascot
   ==================================================== */

// 标准艾宾浩斯记忆强化节点 (单位: 毫秒)
const EBBINGHAUS_INTERVALS = [
  5 * 60 * 1000,          // 第1次: 5分钟后 (即时初次记忆强化)
  30 * 60 * 1000,         // 第2次: 30分钟后
  12 * 60 * 60 * 1000,    // 第3次: 12小时后 (当天晚上)
  24 * 60 * 60 * 1000,    // 第4次: 1天后
  2 * 24 * 60 * 60 * 1000,// 第5次: 2天后
  4 * 24 * 60 * 60 * 1000,// 第6次: 4天后
  7 * 24 * 60 * 60 * 1000,// 第7次: 7天后
  15 * 24 * 60 * 60 * 1000,// 第8次: 15天后
  30 * 24 * 60 * 60 * 1000 // 第9次: 30天后 (形成永久长时记忆)
];

const STAGE_NAMES = [
  '初学阶段 (5分钟复习)',
  '第1阶段 (30分钟)',
  '第2阶段 (12小时)',
  '第3阶段 (1天)',
  '第4阶段 (2天)',
  '第5阶段 (4天)',
  '第6阶段 (7天)',
  '第7阶段 (15天)',
  '终极长时巩固 (30天)',
  '已彻底掌握 🎉'
];

class EbbinghausApp {
  constructor() {
    this.cards = this.loadCards();
    this.currentReviewIndex = 0;
    this.dueCards = [];
    this.audioCtx = null;
    this.speechRecognition = null;
    this.isRecording = false;
    this.hasAlertedCardId = null;

    this.initDOM();
    this.initPinLock();
    this.initTheme();
    this.initServiceWorker();
    this.initVoiceRecognition();
    this.initNotifications();
    this.initTabs();
    this.updateAllViews();
    this.startPeriodicChecker();
  }

  // ----------------------------------------------------
  // 数据持久化 (LocalStorage)
  // ----------------------------------------------------
  loadCards() {
    try {
      const data = localStorage.getItem('ebbinghaus_cards_v1');
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load local cards', e);
    }
    // 默认内置的趣味示范卡片
    return [
      {
        id: 'k_demo_1',
        title: '艾宾浩斯遗忘曲线 (Ebbinghaus Curve)',
        notes: '人的大脑在识记新事物后：\n• 20分钟后仅保留 58%\n• 1小时后仅保留 44%\n• 1天后仅保留 33%\n• 及时进行间隔复习，能够将短期记忆转化为终身长期记忆！',
        tag: '核心原理',
        createdAt: Date.now() - 3600000,
        currentStage: 0,
        nextReviewTime: Date.now() - 1000, // 默认处于待复习状态
        reviewHistory: [],
        isMastered: false
      },
      {
        id: 'k_demo_2',
        title: '间歇重复记忆法 (Spaced Repetition)',
        notes: '利用计算机算法在遗忘临界点出现时自动提醒复习，比死记硬背效率提升 300% 以上。',
        tag: '学习技巧',
        createdAt: Date.now() - 7200000,
        currentStage: 1,
        nextReviewTime: Date.now() + 1800000,
        reviewHistory: [],
        isMastered: false
      }
    ];
  }

  saveCards() {
    try {
      localStorage.setItem('ebbinghaus_cards_v1', JSON.stringify(this.cards));
    } catch (e) {
      console.error('Save failed', e);
    }
    this.updateAllViews();
  }

  // ----------------------------------------------------
  // DOM 绑定与事件初始化
  // ----------------------------------------------------
  initDOM() {
    // 导航标签
    this.navBtns = document.querySelectorAll('.nav-tab-btn');
    this.tabPanels = document.querySelectorAll('.tab-panel');

    // 录入表单
    this.inputForm = document.getElementById('newKnowledgeForm');
    this.titleInput = document.getElementById('knowledgeTitle');
    this.notesInput = document.getElementById('knowledgeNotes');
    this.tagInput = document.getElementById('knowledgeTag');
    this.customIntervalSelect = document.getElementById('customIntervalSelect');
    this.voiceMicBtn = document.getElementById('voiceMicBtn');
    this.voiceLiveText = document.getElementById('voiceLiveText');
    this.tagPresetChips = document.querySelectorAll('.tag-preset-chip');

    // 待复习提醒流容器
    this.reminderItemsList = document.getElementById('reminderItemsList');
    this.emptyReviewQueue = document.getElementById('emptyReviewQueue');
    this.emptyNextNotice = document.getElementById('emptyNextNotice');
    this.dueBadgePill = document.getElementById('dueBadgePill');
    this.reminderSubtitle = document.getElementById('reminderSubtitle');

    // 弹窗与悬浮萌猫
    this.mascotAlertModal = document.getElementById('mascotAlertModal');
    this.mascotAlertClose = document.getElementById('mascotAlertClose');
    this.mascotAlertQuickDoneBtn = document.getElementById('mascotAlertQuickDoneBtn');
    this.mascotAlertTitle = document.getElementById('mascotAlertTitle');
    this.mascotAlertMsg = document.getElementById('mascotAlertMsg');
    this.mascotAlertContentBox = document.getElementById('mascotAlertContentBox');
    this.alertContentTitle = document.getElementById('alertContentTitle');
    this.alertContentNotes = document.getElementById('alertContentNotes');
    this.mascotFab = document.getElementById('mascotFab');
    this.mascotFabBadge = document.getElementById('mascotFabBadge');
    this.headerBadge = document.getElementById('headerDueBadge');
    this.navDueBadge = document.getElementById('navDueBadge');

    // 知识库列表
    this.knowledgeList = document.getElementById('knowledgeList');
    this.searchInput = document.getElementById('knowledgeSearchInput');
    this.filterTagSelect = document.getElementById('filterTagSelect');

    // 统计面板
    this.statTotalCount = document.getElementById('statTotalCount');
    this.statDueCount = document.getElementById('statDueCount');
    this.statMasteredCount = document.getElementById('statMasteredCount');
    this.statStreakDays = document.getElementById('statStreakDays');

    // 事件监听
    if (this.inputForm) {
      this.inputForm.addEventListener('submit', (e) => this.handleAddNewCard(e));
    }

    if (this.voiceMicBtn) {
      this.voiceMicBtn.addEventListener('click', () => this.toggleVoiceRecording());
    }

    if (this.mascotAlertClose) {
      this.mascotAlertClose.addEventListener('click', () => {
        this.mascotAlertModal.classList.remove('active');
      });
    }

    if (this.mascotAlertQuickDoneBtn) {
      this.mascotAlertQuickDoneBtn.addEventListener('click', () => {
        if (this.currentAlertingCardId) {
          this.handleCompleteReview(this.currentAlertingCardId);
        }
        this.mascotAlertModal.classList.remove('active');
      });
    }

    if (this.mascotFab) {
      this.mascotFab.addEventListener('click', () => {
        this.triggerDuolingoAlert(true);
      });
    }

    // 标签预设快捷点击
    this.tagPresetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.tagInput.value = chip.dataset.tag;
        this.tagPresetChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // 搜索过滤
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.renderKnowledgeBase());
    }
    if (this.filterTagSelect) {
      this.filterTagSelect.addEventListener('change', () => this.renderKnowledgeBase());
    }

    // 测试即时提醒按键
    const demoTestBtn = document.getElementById('demoTestAlertBtn');
    if (demoTestBtn) {
      demoTestBtn.addEventListener('click', () => {
        this.showToast('🚀 3秒后将模拟多邻国跳动提醒！');
        setTimeout(() => {
          this.triggerDuolingoAlert(true);
        }, 3000);
      });
    }

    // 白天 / 黑夜主题切换按键
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIconSun = document.getElementById('themeIconSun');
    this.themeIconMoon = document.getElementById('themeIconMoon');
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // 备份导出 / 导入
    const exportBtn = document.getElementById('exportBackupBtn');
    const importInput = document.getElementById('importBackupFileInput') || document.getElementById('importBackupInput');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportBackup());
    }
    if (importInput) {
      importInput.addEventListener('change', (e) => this.importBackup(e));
    }
  }

  // ----------------------------------------------------
  // 私人隐私安全与 PIN 密码锁
  // ----------------------------------------------------
  initPinLock() {
    this.pinOverlay = document.getElementById('pinLockOverlay');
    this.pinTitle = document.getElementById('pinLockTitle');
    this.pinDesc = document.getElementById('pinLockDesc');
    this.pinInput = document.getElementById('pinCodeInput');
    this.pinUnlockBtn = document.getElementById('pinUnlockBtn');
    this.pinRememberCheckbox = document.getElementById('pinRememberDeviceCheckbox');
    this.pinErrorMsg = document.getElementById('pinErrorMsg');
    this.lockAppBtn = document.getElementById('lockAppBtn');
    this.lockNowBtn = document.getElementById('lockNowBtn');
    this.changePinBtn = document.getElementById('changePinBtn');
    this.trustDeviceToggle = document.getElementById('trustDeviceToggle');
    this.pinStatusText = document.getElementById('pinStatusText');

    const savedPin = localStorage.getItem('ebbinghaus_pin_v1');
    const isTrusted = localStorage.getItem('ebbinghaus_trusted_device') === 'true';
    const isSessionUnlocked = sessionStorage.getItem('ebbinghaus_session_unlocked') === 'true';
    const isManuallyLocked = sessionStorage.getItem('ebbinghaus_manual_lock') === 'true';

    // 同步设置面板上的开关
    if (this.trustDeviceToggle) {
      this.trustDeviceToggle.checked = isTrusted;
      this.trustDeviceToggle.addEventListener('change', () => {
        localStorage.setItem('ebbinghaus_trusted_device', this.trustDeviceToggle.checked ? 'true' : 'false');
        this.showToast(this.trustDeviceToggle.checked ? '🔒 已启用本机免密快速访问' : '🔒 已关闭免密，下次访问需密码');
      });
    }

    if (this.pinStatusText) {
      this.pinStatusText.innerText = savedPin ? '已开启专属密码保护' : '未设置（首次需设置）';
    }

    // 绑定顶部锁屏与设置面板锁屏按键
    if (this.lockAppBtn) {
      this.lockAppBtn.addEventListener('click', () => this.lockApp());
    }
    if (this.lockNowBtn) {
      this.lockNowBtn.addEventListener('click', () => this.lockApp());
    }

    // 绑定修改密码按键
    if (this.changePinBtn) {
      this.changePinBtn.addEventListener('click', () => this.handleChangePin());
    }

    // 绑定解锁/设置按钮与回车事件
    if (this.pinUnlockBtn) {
      this.pinUnlockBtn.addEventListener('click', () => this.handlePinSubmit());
    }
    if (this.pinInput) {
      this.pinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handlePinSubmit();
      });
    }

    // 判断当前是否需要展示锁屏
    if (!savedPin) {
      // 首次使用：引导用户设置私密 PIN
      this.showPinSetupPrompt();
    } else if (isManuallyLocked || (!isTrusted && !isSessionUnlocked)) {
      // 需要解锁
      this.showPinUnlockPrompt();
    } else {
      // 满足免密条件，直接通过
      this.hidePinLock();
    }
  }

  showPinSetupPrompt() {
    if (!this.pinOverlay) return;
    this.pinOverlay.style.display = 'flex';
    this.pinTitle.innerText = '👋 欢迎使用私人复习空间';
    this.pinDesc.innerText = '请设置您的专属访问密码（4~12位），防止非本人查看';
    this.pinUnlockBtn.innerText = '设置并开启';
    this.pinInput.value = '';
    this.pinInput.placeholder = '设置新密码 (4~12位)';
    this.pinErrorMsg.style.display = 'none';
    this.isSettingNewPin = true;
    setTimeout(() => this.pinInput.focus(), 300);
  }

  showPinUnlockPrompt() {
    if (!this.pinOverlay) return;
    this.pinOverlay.style.display = 'flex';
    this.pinTitle.innerText = '🔒 私人专属复习空间';
    this.pinDesc.innerText = '已开启隐私保护，请输入专属访问密码解锁';
    this.pinUnlockBtn.innerText = '解锁进入';
    this.pinInput.value = '';
    this.pinInput.placeholder = '输入密码 / PIN';
    this.pinErrorMsg.style.display = 'none';
    this.isSettingNewPin = false;
    setTimeout(() => this.pinInput.focus(), 300);
  }

  hidePinLock() {
    if (this.pinOverlay) {
      this.pinOverlay.style.display = 'none';
    }
    sessionStorage.setItem('ebbinghaus_session_unlocked', 'true');
    sessionStorage.removeItem('ebbinghaus_manual_lock');
  }

  lockApp() {
    sessionStorage.removeItem('ebbinghaus_session_unlocked');
    sessionStorage.setItem('ebbinghaus_manual_lock', 'true');
    this.showPinUnlockPrompt();
    this.showToast('🔒 页面已安全锁定');
  }

  handlePinSubmit() {
    const val = (this.pinInput.value || '').trim();
    if (this.isSettingNewPin) {
      if (val.length < 4) {
        this.showPinError('密码至少需要 4 位字符/数字');
        return;
      }
      localStorage.setItem('ebbinghaus_pin_v1', val);
      if (this.pinRememberCheckbox && this.pinRememberCheckbox.checked) {
        localStorage.setItem('ebbinghaus_trusted_device', 'true');
        if (this.trustDeviceToggle) this.trustDeviceToggle.checked = true;
      }
      if (this.pinStatusText) this.pinStatusText.innerText = '已开启专属密码保护';
      this.hidePinLock();
      this.showToast('🎉 专属密码设置成功，您的知识库已受保护！');
    } else {
      const savedPin = localStorage.getItem('ebbinghaus_pin_v1');
      if (val === savedPin) {
        if (this.pinRememberCheckbox && this.pinRememberCheckbox.checked) {
          localStorage.setItem('ebbinghaus_trusted_device', 'true');
          if (this.trustDeviceToggle) this.trustDeviceToggle.checked = true;
        }
        this.hidePinLock();
        this.showToast('🔓 解锁成功，欢迎回来！');
      } else {
        this.showPinError('密码不正确，请重新输入');
      }
    }
  }

  showPinError(msg) {
    if (this.pinErrorMsg) {
      this.pinErrorMsg.innerText = msg;
      this.pinErrorMsg.style.display = 'block';
      this.pinInput.focus();
      this.pinInput.select();
    }
  }

  handleChangePin() {
    const savedPin = localStorage.getItem('ebbinghaus_pin_v1');
    if (savedPin) {
      const oldPin = prompt('请输入当前的原密码：');
      if (oldPin === null) return;
      if (oldPin !== savedPin) {
        alert('原密码错误，无法修改！');
        return;
      }
    }
    const newPin = prompt('请输入新的访问密码（4~12位）：');
    if (!newPin) return;
    if (newPin.trim().length < 4) {
      alert('新密码至少需要 4 位字符！');
      return;
    }
    localStorage.setItem('ebbinghaus_pin_v1', newPin.trim());
    if (this.pinStatusText) this.pinStatusText.innerText = '已开启专属密码保护';
    this.showToast('✅ 专属密码已成功更新！');
  }

  // ----------------------------------------------------
  // 白天 / 黑夜模式管理 (Light / Dark Theme)
  // ----------------------------------------------------
  initTheme() {
    const savedTheme = localStorage.getItem('ebbinghaus_theme');
    if (savedTheme) {
      this.applyTheme(savedTheme, false);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyTheme(prefersDark ? 'dark' : 'light', false);
    }

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('ebbinghaus_theme')) {
          this.applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }
  }

  applyTheme(theme, showNotice = true) {
    this.currentTheme = theme;
    const isDark = theme === 'dark';

    if (isDark) {
      document.body.classList.add('dark-mode');
      document.documentElement.setAttribute('data-theme', 'dark');
      if (this.themeIconSun) this.themeIconSun.style.display = 'block';
      if (this.themeIconMoon) this.themeIconMoon.style.display = 'none';
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.setAttribute('data-theme', 'light');
      if (this.themeIconSun) this.themeIconSun.style.display = 'none';
      if (this.themeIconMoon) this.themeIconMoon.style.display = 'block';
    }

    // 动态同步状态栏颜色
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#0b0f19' : '#10b981');
    }

    localStorage.setItem('ebbinghaus_theme', theme);

    if (showNotice) {
      this.showToast(isDark ? '🌙 已开启暗夜护眼模式' : '☀️ 已切换为清爽日间模式');
    }
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme, true);
  }

  // ----------------------------------------------------
  // 多标签导航切换
  // ----------------------------------------------------
  initTabs() {
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabId) {
    this.navBtns.forEach(b => {
      if (b.dataset.tab === tabId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    this.tabPanels.forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    if (tabId === 'tab-review') {
      this.renderReviewQueue();
    } else if (tabId === 'tab-library') {
      this.renderKnowledgeBase();
    } else if (tabId === 'tab-stats') {
      this.renderStatsView();
    }
  }

  // ----------------------------------------------------
  // 语音输入引擎 (Web Speech API)
  // ----------------------------------------------------
  initVoiceRecognition() {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) {
      console.warn('SpeechRecognition API not available in this browser');
      if (this.voiceLiveText) {
        this.voiceLiveText.innerText = '当前浏览器未开启语音接口，可直接打字输入~';
      }
      return;
    }

    this.speechRecognition = new SpeechClass();
    this.speechRecognition.lang = 'zh-CN';
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = true;

    this.speechRecognition.onstart = () => {
      this.isRecording = true;
      this.voiceMicBtn.classList.add('is-recording');
      if (this.voiceLiveText) {
        this.voiceLiveText.classList.add('active');
        this.voiceLiveText.innerText = '正在聆听您的新知识...请说话';
      }
    };

    this.speechRecognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      if (this.voiceLiveText) {
        this.voiceLiveText.innerText = `识别中: "${finalTranscript}"`;
      }
      // 智能分词填入：前20字作为标题，后续作为详细内容
      if (finalTranscript.length > 0) {
        if (!this.titleInput.value || this.titleInput.dataset.fromVoice === 'true') {
          if (finalTranscript.length <= 15) {
            this.titleInput.value = finalTranscript;
          } else {
            const splitPoint = finalTranscript.indexOf('：') > -1 ? finalTranscript.indexOf('：') : 15;
            this.titleInput.value = finalTranscript.substring(0, splitPoint).replace(/[，。]/g, '');
            this.notesInput.value = finalTranscript.substring(splitPoint + 1);
          }
          this.titleInput.dataset.fromVoice = 'true';
        } else {
          this.notesInput.value = (this.notesInput.value ? this.notesInput.value + '\n' : '') + finalTranscript;
        }
      }
    };

    this.speechRecognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      this.stopVoiceRecording();
      this.showToast('语音识别未完成，请重试或直接打字输入');
    };

    this.speechRecognition.onend = () => {
      this.stopVoiceRecording();
      this.showToast('语音识别完成！已帮您录入');
    };
  }

  toggleVoiceRecording() {
    if (!this.speechRecognition) {
      this.showToast('请使用支持语音的浏览器(如 Safari / Chrome)');
      return;
    }
    if (this.isRecording) {
      this.speechRecognition.stop();
    } else {
      try {
        this.speechRecognition.start();
      } catch (e) {
        this.speechRecognition.stop();
      }
    }
  }

  stopVoiceRecording() {
    this.isRecording = false;
    if (this.voiceMicBtn) {
      this.voiceMicBtn.classList.remove('is-recording');
    }
  }

  // ----------------------------------------------------
  // 新建知识点
  // ----------------------------------------------------
  handleAddNewCard(e) {
    e.preventDefault();
    const title = this.titleInput.value.trim();
    const notes = this.notesInput.value.trim();
    const tag = this.tagInput.value.trim() || '日常新知';
    const intervalType = this.customIntervalSelect ? this.customIntervalSelect.value : 'standard';

    if (!title) {
      this.showToast('请填写知识点标题或关键词');
      this.titleInput.focus();
      return;
    }

    // 计算初次复习时间
    let firstInterval = EBBINGHAUS_INTERVALS[0]; // 5分钟
    if (intervalType === 'fast') {
      firstInterval = 1 * 60 * 1000; // 1分钟极速测试
    } else if (intervalType === 'daily') {
      firstInterval = 12 * 60 * 60 * 1000; // 12小时
    }

    const newCard = {
      id: 'k_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: title,
      notes: notes || '暂无详细助记',
      tag: tag,
      createdAt: Date.now(),
      currentStage: 0,
      nextReviewTime: Date.now() + firstInterval,
      reviewHistory: [],
      isMastered: false
    };

    this.cards.unshift(newCard);
    this.saveCards();

    // 清空表单
    this.titleInput.value = '';
    this.notesInput.value = '';
    delete this.titleInput.dataset.fromVoice;

    this.playCelebrationChime();
    this.showToast(`🎉 成功添加新知识！将在 5分钟 后提醒首次复习`);

    // 自动切换到复习或知识库页面
    this.switchTab('tab-library');
  }

  // ----------------------------------------------------
  // 渲染待复习队列 (Flashcard Review)
  // ----------------------------------------------------
  // 渲染待复习提醒流 (直接呈现清单，无需翻转抽认卡)
  // ----------------------------------------------------
  renderReviewQueue() {
    const now = Date.now();
    this.dueCards = this.cards.filter(c => !c.isMastered && c.nextReviewTime <= now);
    this.dueCards.sort((a, b) => a.nextReviewTime - b.nextReviewTime);

    const totalDue = this.dueCards.length;

    if (this.dueBadgePill) {
      this.dueBadgePill.innerText = `${totalDue} 项待复习`;
      if (totalDue === 0) {
        this.dueBadgePill.style.background = 'var(--primary-light)';
        this.dueBadgePill.style.color = 'var(--primary)';
        this.dueBadgePill.style.borderColor = 'var(--primary-border)';
      } else {
        this.dueBadgePill.style.background = '';
        this.dueBadgePill.style.color = '';
        this.dueBadgePill.style.borderColor = '';
      }
    }

    if (this.reminderSubtitle) {
      this.reminderSubtitle.innerText = totalDue > 0
        ? `到达艾宾浩斯强化时间点，花10秒过目即可牢牢加固！`
        : `当前无到期待办，艾宾浩斯记忆引擎持续监控中`;
    }

    if (totalDue === 0) {
      if (this.reminderItemsList) {
        this.reminderItemsList.style.display = 'none';
        this.reminderItemsList.innerHTML = '';
      }
      if (this.emptyReviewQueue) {
        this.emptyReviewQueue.style.display = 'block';
        const upcoming = this.cards.filter(c => !c.isMastered && c.nextReviewTime > now);
        if (upcoming.length > 0) {
          upcoming.sort((a, b) => a.nextReviewTime - b.nextReviewTime);
          const nextOne = upcoming[0];
          const diffMs = nextOne.nextReviewTime - now;
          if (this.emptyNextNotice) {
            this.emptyNextNotice.innerText = `下一个知识点「${nextOne.title}」将在 ${this.formatRemainingTime(diffMs)} 后跳动提醒您！`;
          }
        } else {
          if (this.emptyNextNotice) {
            this.emptyNextNotice.innerText = '暂无待复习知识，点击下方去录入新知识吧！';
          }
        }
      }
      return;
    }

    if (this.reminderItemsList) {
      this.reminderItemsList.style.display = 'flex';
    }
    if (this.emptyReviewQueue) {
      this.emptyReviewQueue.style.display = 'none';
    }

    let html = '';
    this.dueCards.forEach(card => {
      const stageName = STAGE_NAMES[card.currentStage] || '初次复习';
      const delayMs = now - card.nextReviewTime;
      const overdueHint = delayMs > 60000 
        ? `🔥 已到期 ${this.formatDuration(delayMs)} · 建议立刻过目`
        : `⚡ 刚到达复习时间点`;

      html += `
        <div class="reminder-card-item is-urgent" id="reminderCard_${card.id}">
          <div class="reminder-item-header">
            <h3 class="reminder-item-title">${this.escapeHtml(card.title)}</h3>
            <div class="reminder-item-meta">
              <span class="card-tag">${this.escapeHtml(card.tag || '知识')}</span>
              <span class="card-stage-pill">${stageName}</span>
            </div>
          </div>

          <div class="reminder-item-notes">${this.escapeHtml(card.notes)}</div>

          <div class="reminder-item-actions">
            <div class="reminder-item-actions-left">
              <span class="reminder-status-tag">${overdueHint}</span>
              <button class="btn-sm-icon btn-speak-item" data-id="${card.id}" title="语音朗读">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              </button>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn-snooze btn-snooze-item" data-id="${card.id}">
                ⏰ 延后10分
              </button>
              <button class="btn-mark-done btn-done-item" data-id="${card.id}">
                ✅ 完成本次复习
              </button>
            </div>
          </div>
        </div>
      `;
    });

    this.reminderItemsList.innerHTML = html;

    // 绑定朗读
    this.reminderItemsList.querySelectorAll('.btn-speak-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.speakCardById(btn.dataset.id);
      });
    });

    // 绑定延后10分钟
    this.reminderItemsList.querySelectorAll('.btn-snooze-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSnoozeReminder(btn.dataset.id, 10);
      });
    });

    // 绑定完成复习
    this.reminderItemsList.querySelectorAll('.btn-done-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCompleteReview(btn.dataset.id);
      });
    });
  }

  // ----------------------------------------------------
  // 完成本次复习打卡 (自动晋升艾宾浩斯强化阶段)
  // ----------------------------------------------------
  handleCompleteReview(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;

    const now = Date.now();
    const nextStage = card.currentStage + 1;

    if (nextStage >= EBBINGHAUS_INTERVALS.length) {
      card.isMastered = true;
      card.currentStage = nextStage;
      card.nextReviewTime = now + 365 * 24 * 3600 * 1000;
      this.showToast(`🏆「${card.title}」已完成全部9轮强化，形成终生永久记忆！`);
    } else {
      const nextInterval = EBBINGHAUS_INTERVALS[nextStage];
      card.currentStage = nextStage;
      card.nextReviewTime = now + nextInterval;
      this.showToast(`✅ 复习打卡完成！下次提醒将在 ${this.formatDuration(nextInterval)} 后`);
    }

    card.reviewHistory.push({
      time: now,
      stageAfter: card.currentStage
    });

    this.playCardCompleteSound();
    this.vibrateDevice();
    this.saveCards();
    this.renderReviewQueue();
  }

  // 延后提醒
  handleSnoozeReminder(cardId, minutes = 10) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;
    card.nextReviewTime = Date.now() + minutes * 60 * 1000;
    this.saveCards();
    this.showToast(`⏰ 已为您延后 ${minutes} 分钟再提醒`);
    this.renderReviewQueue();
  }

  // 朗读指定卡片
  speakCardById(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;
    if (!('speechSynthesis' in window)) {
      this.showToast('当前浏览器不支持语音朗读');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(`${card.title}。${card.notes}`);
    utter.lang = 'zh-CN';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
    this.showToast('正在为您朗读知识点 🔊');
  }

  // ----------------------------------------------------
  // 多邻国式跳动萌猫弹窗与系统提醒
  // ----------------------------------------------------
  triggerDuolingoAlert(forceManual = false) {
    const now = Date.now();
    const dueList = this.cards.filter(c => !c.isMastered && c.nextReviewTime <= now);
    if (!dueList.length) {
      if (forceManual) {
        this.showToast('目前没有待复习的项目，你太勤奋啦！🌟');
      }
      return;
    }

    const firstDue = dueList[0];
    if (!forceManual && this.hasAlertedCardId === firstDue.id) {
      return;
    }
    this.hasAlertedCardId = firstDue.id;
    this.currentAlertingCardId = firstDue.id;

    // 填充弹窗内容
    if (this.mascotAlertTitle) {
      this.mascotAlertTitle.innerText = `⏰ 艾宾浩斯复习提醒！`;
    }
    if (this.mascotAlertMsg) {
      this.mascotAlertMsg.innerText = `知识点「${firstDue.title}」已到达强化时间点，快花10秒过目一下！`;
    }

    // 弹窗直接展示需要复习的内容，用户10秒直接过目
    if (this.mascotAlertContentBox) {
      this.mascotAlertContentBox.style.display = 'block';
      if (this.alertContentTitle) {
        this.alertContentTitle.innerText = firstDue.title;
      }
      if (this.alertContentNotes) {
        this.alertContentNotes.innerText = firstDue.notes || '暂无详细助记';
      }
    }

    // 播放多邻国式欢快提醒音效与手机震动
    this.playDuolingoChime();
    this.vibrateDevice();

    // 显示跳动弹窗
    if (this.mascotAlertModal) {
      this.mascotAlertModal.classList.add('active');
    }

    // 发送系统级推送通知 (即使页面退居后台也能收到)
    this.sendSystemNotification(
      '🦉 艾宾浩斯复习提醒',
      `「${firstDue.title}」到达艾宾浩斯复习点！点击立即过目巩固长时记忆。`
    );
  }

  startPeriodicChecker() {
    // 每 20 秒检查一次是否有新到期的记忆卡片
    setInterval(() => {
      const now = Date.now();
      const dueCount = this.cards.filter(c => !c.isMastered && c.nextReviewTime <= now).length;
      this.updateBadges(dueCount);

      if (dueCount > 0) {
        this.triggerDuolingoAlert(false);
      }
    }, 20000);
  }

  // ----------------------------------------------------
  // 知识库渲染与管理
  // ----------------------------------------------------
  renderKnowledgeBase() {
    if (!this.knowledgeList) return;

    const searchTerm = this.searchInput ? this.searchInput.value.toLowerCase().trim() : '';
    const filterTag = this.filterTagSelect ? this.filterTagSelect.value : 'all';

    let filtered = this.cards.filter(card => {
      const matchSearch = card.title.toLowerCase().includes(searchTerm) || card.notes.toLowerCase().includes(searchTerm);
      const matchTag = filterTag === 'all' || card.tag === filterTag;
      return matchSearch && matchTag;
    });

    if (filtered.length === 0) {
      this.knowledgeList.innerHTML = `
        <div class="empty-queue-card" style="padding: 30px;">
          <p style="font-size: 0.95rem; color: var(--text-muted); font-weight: 600;">没有找到匹配的知识点</p>
        </div>
      `;
      return;
    }

    const now = Date.now();
    let html = '';
    filtered.forEach(card => {
      const isDue = !card.isMastered && card.nextReviewTime <= now;
      const stageStr = card.isMastered ? '已掌握 🏆' : (STAGE_NAMES[card.currentStage] || '学习中');
      const timeRemaining = card.isMastered ? '永久记忆' : (isDue ? '⚡ 正在待复习' : `${this.formatRemainingTime(card.nextReviewTime - now)} 后复习`);

      html += `
        <div class="knowledge-item-card" data-id="${card.id}">
          <div class="item-card-header">
            <h4 class="item-card-title">${this.escapeHtml(card.title)}</h4>
            <span class="card-tag">${this.escapeHtml(card.tag || '知识')}</span>
          </div>
          <div class="item-card-notes">${this.escapeHtml(card.notes)}</div>
          <div class="item-card-footer">
            <div>
              <span class="card-stage-pill" style="${isDue ? 'background: var(--rose-light); color: var(--rose); border-color: #fecdd3;' : ''}">
                ${stageStr} · ${timeRemaining}
              </span>
            </div>
            <div class="item-action-btns">
              <button class="btn-sm-icon delete-card-btn" data-id="${card.id}" title="删除知识点">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    this.knowledgeList.innerHTML = html;

    // 绑定删除按钮
    this.knowledgeList.querySelectorAll('.delete-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('确定要删除这个知识点吗？')) {
          this.cards = this.cards.filter(c => c.id !== id);
          this.saveCards();
          this.showToast('已删除知识点');
        }
      });
    });
  }

  // ----------------------------------------------------
  // 统计面板与艾宾浩斯曲线绘制
  // ----------------------------------------------------
  renderStatsView() {
    const total = this.cards.length;
    const now = Date.now();
    const due = this.cards.filter(c => !c.isMastered && c.nextReviewTime <= now).length;
    const mastered = this.cards.filter(c => c.isMastered).length;

    if (this.statTotalCount) this.statTotalCount.innerText = total;
    if (this.statDueCount) this.statDueCount.innerText = due;
    if (this.statMasteredCount) this.statMasteredCount.innerText = mastered;
    if (this.statStreakDays) this.statStreakDays.innerText = '7天 🔥';
  }

  updateAllViews() {
    const now = Date.now();
    const dueCount = this.cards.filter(c => !c.isMastered && c.nextReviewTime <= now).length;
    this.updateBadges(dueCount);
    this.renderReviewQueue();
    this.renderKnowledgeBase();
    this.renderStatsView();
  }

  updateBadges(count) {
    [this.headerBadge, this.navDueBadge, this.mascotFabBadge].forEach(badge => {
      if (badge) {
        if (count > 0) {
          badge.style.display = 'flex';
          badge.innerText = count > 99 ? '99+' : count;
        } else {
          badge.style.display = 'none';
        }
      }
    });
  }

  // ----------------------------------------------------
  // 语音合成朗读 (Text-to-Speech)
  // ----------------------------------------------------
  speakCurrentCard() {
    if (!('speechSynthesis' in window)) {
      this.showToast('当前浏览器不支持语音朗读');
      return;
    }
    const currentCard = this.dueCards[this.currentReviewIndex];
    if (!currentCard) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(`${currentCard.title}。${currentCard.notes}`);
    utter.lang = 'zh-CN';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
    this.showToast('正在为您朗读知识点 🔊');
  }

  // ----------------------------------------------------
  // 多邻国风格音频合成与手机震动反馈
  // ----------------------------------------------------
  initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playDuolingoChime() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      // 欢快上扬的双音节灵动 chime: G5 -> C6
      const playTone = (freq, startTime, duration) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      };
      playTone(783.99, now, 0.18); // G5
      playTone(1046.50, now + 0.14, 0.35); // C6
    } catch (e) {}
  }

  playCardCompleteSound() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch (e) {}
  }

  playCelebrationChime() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.18, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch (e) {}
  }

  vibrateDevice() {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([120, 80, 160]);
      } catch (e) {}
    }
  }

  // ----------------------------------------------------
  // 系统桌面 / 手机锁屏推送权限与提醒
  // ----------------------------------------------------
  initNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
      const askBtn = document.getElementById('enableNotificationBtn');
      if (askBtn) {
        askBtn.addEventListener('click', () => {
          Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
              this.showToast('✅ 桌面/锁屏推送权限已开启！');
            }
          });
        });
      }
    }
  }

  sendSystemNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: body,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          vibrate: [200, 100, 200]
        });
        notif.onclick = () => {
          window.focus();
          this.switchTab('tab-review');
        };
      } catch (e) {}
    }
  }

  // ----------------------------------------------------
  // PWA Service Worker 注册
  // ----------------------------------------------------
  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
          console.log('SW Registered:', reg.scope);
        }).catch(err => {
          console.log('SW Registration failed:', err);
        });
      });
    }
  }

  // ----------------------------------------------------
  // 数据备份与恢复
  // ----------------------------------------------------
  exportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.cards, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `ebbinghaus_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    this.showToast('📥 知识库备份文件已下载！');
  }

  importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          this.cards = imported;
          this.saveCards();
          this.showToast(`成功恢复 ${imported.length} 个知识点！`);
        }
      } catch (err) {
        this.showToast('导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  }

  // ----------------------------------------------------
  // 辅助工具方法
  // ----------------------------------------------------
  showToast(msg) {
    let toast = document.getElementById('toastNotice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotice';
      toast.className = 'toast-notice';
      document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  formatDuration(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}小时`;
    const days = Math.round(hours / 24);
    return `${days}天`;
  }

  formatRemainingTime(ms) {
    if (ms <= 0) return '立刻';
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    if (hours < 24) return `${hours}小时${remMin > 0 ? remMin + '分' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days}天`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// 启动应用程序
window.addEventListener('DOMContentLoaded', () => {
  window.ebbinghausApp = new EbbinghausApp();
});
