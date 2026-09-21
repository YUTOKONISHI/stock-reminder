<?php

describe('index', function () {
    it('商品とカテゴリの一覧を返す', function () {
        //
    });

    it('カテゴリで絞り込む', function () {
        //
    });

    it('categoriesが空なら1件も返さない', function () {
        //
    });
});

describe('store', function () {
    it('商品を登録する', function () {
        //
    });

    it('登録した管理者を created_by と updated_by に残す', function () {
        //
    });

    it('入力が欠けていれば弾く', function () {
        //
    });
});

describe('update', function () {
    it('商品を更新し、updated_by を書き換える', function () {
        //
    });

    it('入力が欠けていれば弾く', function () {
        //
    });
});

describe('destroy', function () {
    it('使われていない商品は削除できる', function () {
        //
    });

    it('利用者のストックにある商品は削除できない', function () {
        //
    });
});

describe('未ログイン', function () {
    it('操作するとログイン画面へ送られる', function () {
        //
    });
});
