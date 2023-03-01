import * as assert from 'assert';
import * as sinon from 'sinon';
import { InputBoxOptions, QuickPickItem, QuickPickOptions, Uri, window } from 'vscode';
import { CancellationEvent } from '../../src/models/cancellationEvent';
import * as userInteraction from '../../src/utils/userInteraction';

interface ITestItem extends QuickPickItem {
  id: number;
  label: string;
  description: string;
  testProperty: string;
}

describe('User interaction tests', () => {
  let windowMock: sinon.SinonMock;
  // let getConfigurationMock: any;
  // let withProgressMock: any;

  beforeEach(() => {
    windowMock = sinon.mock(window);
    // getConfigurationMock = sinon.stub(workspace, 'getConfiguration');
    // withProgressMock = sinon.stub(window, 'withProgress');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('showInputBox should return a value', async () => {
    const option: InputBoxOptions = {};
    windowMock.expects('showInputBox').withArgs(option).returns('test');
    const result = await userInteraction.showInputBox(option);
    assert.strictEqual(result, 'test');
  });

  it('showInputBox should throw cancellation event', async () => {
    const option: InputBoxOptions = {};
    windowMock.expects('showInputBox').withArgs(option).returns(undefined);
    await assert.rejects(userInteraction.showInputBox(option), CancellationEvent);
  });

  it('showQuickPick should return a value', async () => {
    const option: QuickPickOptions = {};
    const items: QuickPickItem[] = [
      {
        description: 'test 1',
        label: 'test 1',
      },
      {
        description: 'test 2',
        label: 'test 2',
      },
    ];

    windowMock.expects('showQuickPick').withArgs(items, option).returns(items[1]);
    const result = await userInteraction.showQuickPick(items, option);
    assert.deepStrictEqual(result, items[1]);
  });

  it('showQuickPick with custom items should return a value', async () => {
    const option: QuickPickOptions = {};
    const items: ITestItem[] = [
      {
        description: 'test 1',
        id: 1,
        label: 'test 1',
        testProperty: 'test 1',
      },
      {
        description: 'test 2',
        id: 2,
        label: 'test 2',
        testProperty: 'test 2',
      },
    ];

    windowMock.expects('showQuickPick').withArgs(items, option).returns(items[1]);
    const result = await userInteraction.showQuickPick(items, option);
    assert.deepStrictEqual(result, items[1]);
  });

  it('showQuickPick should throw cancellation event', async () => {
    const option: QuickPickOptions = {};
    const items: QuickPickItem[] = [
      {
        description: 'test 1',
        label: 'test 1',
      },
      {
        description: 'test 2',
        label: 'test 2',
      },
    ];

    windowMock.expects('showQuickPick').withArgs(items, option).returns(undefined);
    await assert.rejects(userInteraction.showQuickPick(items, option), CancellationEvent);
  });

  it('showOpenFolderDialog should return a folder path', async () => {
    const folderPath = 'test/test';
    const uris: Uri[] = [{ fsPath: folderPath } as Uri];

    windowMock.expects('showOpenDialog').returns(uris);
    const result = await userInteraction.showOpenFolderDialog();
    assert.deepStrictEqual(result, folderPath);
  });

  it('showOpenFolderDialog should return path of first folder', async () => {
    const folderPath1 = 'test/test';
    const folderPath2 = 'test2/test2';
    const uris: Uri[] = [{ fsPath: folderPath1 }, { fsPath: folderPath2 }] as Uri[];

    windowMock.expects('showOpenDialog').returns(uris);
    const result = await userInteraction.showOpenFolderDialog();
    assert.strictEqual(result, folderPath1);
  });

  it('showOpenFolderDialog should throw cancellation event if dialog cancelled', async () => {
    windowMock.expects('showOpenDialog').returns(undefined);
    await assert.rejects(userInteraction.showOpenFolderDialog(), CancellationEvent);
  });
});
