const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file://' + path.resolve(__dirname, 'shopping-list.html');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(FILE_URL);
  await clearStorage(page);

  console.log('\n[테스트 1] 초기 빈 상태 확인');
  const emptyMsg = await page.locator('.empty').textContent();
  assert(emptyMsg.includes('비어'), '빈 리스트 메시지 표시');

  const statsText = await page.locator('#stats').textContent();
  assert(statsText.trim() === '', '통계 텍스트가 비어 있음');

  console.log('\n[테스트 2] 아이템 추가 — 버튼 클릭');
  await page.fill('#itemInput', '사과');
  await page.click('button:has-text("추가")');

  let items = await page.locator('.item').count();
  assert(items === 1, '아이템 1개 추가됨');

  const firstText = await page.locator('.item-text').first().textContent();
  assert(firstText === '사과', '추가된 아이템 텍스트 일치');

  const inputVal = await page.inputValue('#itemInput');
  assert(inputVal === '', '추가 후 입력창 초기화');

  console.log('\n[테스트 3] 아이템 추가 — Enter 키');
  await page.fill('#itemInput', '바나나');
  await page.press('#itemInput', 'Enter');

  items = await page.locator('.item').count();
  assert(items === 2, 'Enter로 아이템 추가됨 (총 2개)');

  await page.fill('#itemInput', '포도');
  await page.press('#itemInput', 'Enter');
  items = await page.locator('.item').count();
  assert(items === 3, 'Enter로 아이템 추가됨 (총 3개)');

  console.log('\n[테스트 4] 빈 입력 추가 시도 (무시되어야 함)');
  await page.fill('#itemInput', '   ');
  await page.click('button:has-text("추가")');
  items = await page.locator('.item').count();
  assert(items === 3, '공백 입력은 추가되지 않음');

  console.log('\n[테스트 5] 통계 표시 확인');
  const stats1 = await page.locator('#stats').textContent();
  assert(stats1.includes('3개'), '총 아이템 수 통계 표시');
  assert(stats1.includes('0개 완료'), '완료 수 0 표시');

  console.log('\n[테스트 6] 체크 기능 — 완료 표시');
  const checkboxes = page.locator('.item input[type="checkbox"]');
  await checkboxes.first().check();

  const checkedItems = await page.locator('.item.checked').count();
  assert(checkedItems === 1, '체크 시 .checked 클래스 추가됨');

  const stats2 = await page.locator('#stats').textContent();
  assert(stats2.includes('1개 완료'), '완료 1개 통계 갱신');

  const clearBtn = await page.locator('#clearBtn').isVisible();
  assert(clearBtn, '완료 항목 있으면 "완료 항목 삭제" 버튼 표시');

  console.log('\n[테스트 7] 체크 해제 — 토글');
  await checkboxes.first().uncheck();
  const checkedAfterUncheck = await page.locator('.item.checked').count();
  assert(checkedAfterUncheck === 0, '체크 해제 시 .checked 클래스 제거됨');

  const stats3 = await page.locator('#stats').textContent();
  assert(stats3.includes('0개 완료'), '체크 해제 후 통계 0으로 복원');

  console.log('\n[테스트 8] 아이템 삭제');
  const itemsBefore = await page.locator('.item').count();
  await page.locator('.delete-btn').first().click();
  const itemsAfter = await page.locator('.item').count();
  assert(itemsAfter === itemsBefore - 1, '삭제 버튼으로 아이템 제거됨');

  const remainingTexts = await page.locator('.item-text').allTextContents();
  assert(!remainingTexts.includes('사과'), '삭제된 아이템이 목록에서 사라짐');

  console.log('\n[테스트 9] 완료 항목 일괄 삭제');
  const allCheckboxes = page.locator('.item input[type="checkbox"]');
  await allCheckboxes.nth(0).check();
  await allCheckboxes.nth(1).check();

  const checkedCount = await page.locator('.item.checked').count();
  assert(checkedCount === 2, '2개 아이템 체크됨');

  await page.locator('#clearBtn').click();
  const itemsAfterClear = await page.locator('.item').count();
  assert(itemsAfterClear === 0, '완료 항목 일괄 삭제 후 리스트 비어 있음');

  const emptyAfterClear = await page.locator('.empty').isVisible();
  assert(emptyAfterClear, '빈 리스트 메시지 다시 표시됨');

  console.log('\n[테스트 10] localStorage 영속성');
  await page.fill('#itemInput', '우유');
  await page.press('#itemInput', 'Enter');
  await page.fill('#itemInput', '달걀');
  await page.press('#itemInput', 'Enter');

  await page.locator('.item input[type="checkbox"]').first().check();

  await page.reload();

  const itemsAfterReload = await page.locator('.item').count();
  assert(itemsAfterReload === 2, '새로고침 후 아이템 유지됨');

  const checkedAfterReload = await page.locator('.item.checked').count();
  assert(checkedAfterReload === 1, '새로고침 후 체크 상태 유지됨');

  console.log('\n══════════════════════════════════════');
  console.log(`테스트 결과: ${passed + failed}개 중 ${passed}개 통과, ${failed}개 실패`);
  if (failed === 0) {
    console.log('🎉 모든 테스트 통과!');
  } else {
    console.log('⚠️  일부 테스트 실패');
  }
  console.log('══════════════════════════════════════\n');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();