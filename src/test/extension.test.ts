import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('AlaGARBAA.super-fast-prompts'));
	});

	test('Should activate extension', async () => {
		const extension = vscode.extensions.getExtension('AlaGARBAA.super-fast-prompts');
		await extension?.activate();
		assert.strictEqual(extension?.isActive, true);
	});
});
