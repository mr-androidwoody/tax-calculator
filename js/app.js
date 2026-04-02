console.log('app loaded');

const runBtn = document.getElementById('runCalculationBtn');
const sampleBtn = document.getElementById('loadSampleBtn');
const toggleBtn = document.getElementById('toggleRawJsonBtn');

console.log('buttons found', { runBtn, sampleBtn, toggleBtn });

console.log('before run listener');
if (runBtn) {
  runBtn.addEventListener('click', () => {
    console.log('run clicked');
  });
}
console.log('after run listener');

console.log('before sample listener');
if (sampleBtn) {
  sampleBtn.addEventListener('click', () => {
    console.log('sample clicked');
  });
}
console.log('after sample listener');

console.log('before toggle listener');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    console.log('toggle clicked');
    const panel = document.getElementById('rawJsonPanel');
    if (panel) panel.classList.toggle('hidden');
  });
}
console.log('after toggle listener');

document.body.addEventListener('click', (event) => {
  console.log('body click', event.target);
});