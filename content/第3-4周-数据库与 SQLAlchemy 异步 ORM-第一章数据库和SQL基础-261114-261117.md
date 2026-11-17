# 第3-4周-数据库与 SQLAlchemy 异步 ORM-第一章数据库和SQL基础-261114-261117

# GOALS

> 理解数据怎样从内存进入数据库、怎样安全地读写，以及 ORM 如何影响实际 SQL 查询
> 
> 

项目主线：把任务状态从内存迁移到数据库（先用 SQLite，后换 MySQL），实现持久化。

- 用 SQLAlchemy 2.0 声明式模型定义 `User`、`Task`、`Message` 三张表

- 用 `AsyncSession` 管理数据库会话，每个请求一个 session，用 `yield` 依赖保证异常时回滚

- 实现任务状态流转：`PENDING → RUNNING → SUCCESS/FAILED`

- 关掉 SQLAlchemy 的懒加载（`lazy="raise"`），强制自己显式预加载，避免 N+1 查询

必须扩展的高频知识：

- 索引原理：B+ 树索引为什么能加速查询，什么情况下索引会失效（最左前缀、函数操作、类型转换）

- 事务与隔离级别：ACID、脏读/不可重复读/幻读，MySQL 默认 RR 级别

- N+1 查询问题：ORM 里最容易踩的坑，面试常问“你的项目有没有慢查询，怎么发现的”

- 连接池：`pool_size`、`max_overflow`、`pool_pre_ping` 的作用，为什么不能每次请求新建连接

产出：数据库里能查到完整的任务生命周期记录，服务重启后任务不丢。







# 一、数据库和SQL基础

https://github.com/datawhalechina/wonderful-sql/blob/main/ch00_%E7%8E%AF%E5%A2%83%E6%90%AD%E5%BB%BA.md#1-mysql-80-%E7%9A%84%E5%AE%89%E8%A3%85



## 第一章 初识数据库

### 1.1 数据库常识介绍

数据库（Database, DB）是将大量数据保存起来，通过计算机加工而成的可以进行高效访问的数据集合。用来管理数据库的计算机系统被称为数据管理系统（Database Management System，DBMS）。

DBMS主要通过数据的保存格式进行分类，现阶段主要有以下五种类型：

- 层次数据库（Hierarchical Database，HDB）

- 关系数据库（Relational Database，RDB）：Oracle、DB2、PostgreSQL、MySQL

以上是比较典型的RDBMS，其特点是由行和列组成的二维表来管理数据，这种类型的DBMS称为 Relational Database Management System

- 面向对象数据库（Object Oriented Database，OODB）

- XML 数据库（XML Database）

- 键值存储系统（Key-Value Store，KVS）：MongoDB

使用RDBMS时候，最常见的系统结构就是客户端/服务器类型（C/S类型）这种结构：

![Image](assets/images/9b4ade198d/image-01.png)

要请求调用数据库的程序叫做客户端，通过执行SQL语句向服务器请求数据，服务器上会有关系型数据库管理系统，可以连接数据库，并运行读取数据库的程序，将请求到的数据返回客户端。



### 1.2 初识 SQL

![Image](assets/images/9b4ade198d/image-02.png)

在数据库中，行被称为记录，列被称为字段，它代表了表中存储的数据项目。行和列交汇的地方被称为单元格。

根据对RDBMS赋予的指令种类的不同，SQL语句可以分为三类：

- DDL（Data Definition Language）：数据定义语言

- DML（Data Manipulation Language）：数据操纵语言，包含 SELECT INSERT UPDATE DELETE指令，最常用

- DCL（Data Control Language）：数据控制语言

SQL的基本书写规则

- SQL语句要以**分号（ ; ）**结尾

- SQL 不区分关键字的大小写，但是插入到表中的数据是区分大小写的

- win 系统默认不区分表名及字段名的大小写

- linux / mac 默认严格区分表名及字段名的大小写 。

- 常数的书写方式是固定的



### 1.3 常见SQL语句

#### 1.3.1 数据库创建与选择

```SQL
CREATE DATABASE < 数据库名称 > -- 比如 CREATE DATABASE shop
-- 查询所有数据库
SHOW DATABASES
-- 创建表之前先选择在哪个数据库内建表
USE < 已经创建的数据库名称 > -- 比如 USE shop
```

#### 1.3.2 表的创建

```SQL
CREATE TABLE < 表名 >
( < 列名 1> < 数据类型 > < 该列所需约束 > < 默认设置 > ,
  < 列名 2> < 数据类型 > < 该列所需约束 > < 默认设置 > ,
  < 列名 3> < 数据类型 > < 该列所需约束 > < 默认设置 > ,
  < 列名 4> < 数据类型 > < 该列所需约束 > < 默认设置 > ,
  .
  .
  .
  < 该表的约束 1> , < 该表的约束 2> ,……);
```

比如：

```SQL
CREATE TABLE product
(
    product_id CHAR(4) NOT NULL, -- 达不到长度用半角空格补齐
    product_name VARCHAR(100) NOT NULL, -- VARCHAR 可变长度; NOT NULL 代表不允许这一列为空
    product_type VARCHAR(32) NOT NULL DEFAULT "水果", -- DEFAULT "水果"：插入商品时如果没有提供 product_type，数据库会自动填入默认值 "水果"。
    sale_price INTEGER, -- 存放整数的类型
    purchase_price INTEGER,
    regist_data DATE, -- DATE 是日期类型
    PRIMARY KEY (product_id) -- 主键约束，表示 product_id 是主键，代表该列是唯一值，可以通过该列取出特定的行的数据   
);

```

和下表是一一对应的，

![Image](assets/images/9b4ade198d/image-03.png)

#### 1.3.3 表的删除和更新

- 删除表的语法：

```SQL
DROP TABLE < 表名 >;  
DROP TABLE shop;
```

DROP的表是无法恢复的，只能重新插入

- 添加列的语法：

```SQL
ALTER TABLE < 表名 > ADD COLUMN < 列的定义 >;
-- 在名为 product 的表中插入一列 可以存储100位的可变字符串的名为 product_name_pinyin 的列
ALTER TABLE product ADD COLUMN product_name_pinyin VARCHAR(100);
```

- 删除列的语法：

```SQL
ALTER TABLE < 表名 > DROP COLUMN < 列名 >
-- 删除 product 表中名为 product_name_pinyin 的列
ALTER TABLE product DROP COLUMN product_name_pinyin 
```

ALTER后的表执行后也无法恢复，误添加的列可以通过ALTER TABLE删除，或者将表全部删除后重新再创建。

- 删除表中特定的行的语法：

```SQL
DELETE FROM < 表名 > WHERE < 列名 >='xxx'
-- 删除满足 product_id（主键）为0003的数据行
DELETE FROM product WHERE product_id=0003
```

- 清空表内容

```SQL
TRUNCATE TABLE TABLE_NAME;
TRUNCATE TABLE product;
```

相比于 DROP/DELETE，TRUNCATE用来清数据时候速度最快

- 数据的更新

```SQL
-- 基本语法
UPDATE <表名>
   SET <列名> = <表达式>
 WHERE <条件> -- 不加WHERE会UPDATE所有行
 ORDER BY 字句
```

比如：

```SQL
-- 全表更新，不使用 WHERE 条件
UPDATE product
   SET regist_date = "2026-11-11";
```

![Image](assets/images/9b4ade198d/image-04.png)

```SQL
-- 只修改符合WHERE条件的行
UPDATE product
   SET product_price = sale_price * 10
 WHERE product_type = '厨房用具';
```

![Image](assets/images/9b4ade198d/image-05.png)

使用 UPDATE 也可以将列更新为 NULL（该更新俗称为NULL清空），此时只需要将赋值表达式右边的值直接写为 NULL 即可。

```SQL
UPDATE product
   SET regist_date = NULL
 WHERE product = '0008'
```

![Image](assets/images/9b4ade198d/image-06.png)

**但是只有未设置NOT NULL约束和主键约束的列才可以清空为NULL，否则会出错，这一点和INSERT语句相同**

```SQL
CREATE TABLE product
(
    product_id CHAR(4) NOT NULL, 
    product_name VARCHAR(100) NOT NULL, 
    product_type VARCHAR(32) NOT NULL DEFAULT "水果", 
    sale_price INTEGER, 
    purchase_price INTEGER,
    regist_data DATE, 
    PRIMARY KEY (product_id)  
);

```

以之前创建的TABLE product为例，其中 `product_name `、`product_type`因为受到该列 `NOT NULL` 的约束不能执行 NULL清空，而 `product_id `因为是主键约束也不能执行 NULL 清空。

同时数据更新还支持多列更新：

```SQL
UPDATE product
   SET sale_price = sale_price * 10,
       purchase_price = purchase_price / 2 -- SET 字句可以三句甚至更多
 WHERE product_type = '厨房用具';
```

![Image](assets/images/9b4ade198d/image-07.png)

#### 1.3.4 向表中插入数据

我们再新建一个名为 productins 的表：

```SQL
CREATE TABLE productins
(
    product_id CHAR(4) NOT NULL, 
    product_name VARCHAR(100) NOT NULL, 
    product_type VARCHAR(32) NOT NULL, 
    sale_price INTEGER DEFAULT 0, 
    purchase_price INTEGER,
    regist_data DATE, 
    PRIMARY KEY (product_id)  
);

```

|product_id|product_name|product_type|sale_price|purchase_price|regist_date|
|---|---|---|---|---|---|
|||||||
|||||||
|||||||
|||||||

插入数据的语法：

```SQL
INSERT INTO <表名> (列1, 列2, 列3, ...) VALUES (值1, 值2, 值3, ...);
```

比如：

```SQL
INSERT INTO productins (product_id, product_name, product_type, sale_price, purchase_price, regist_data) VALUES ('0005', '高压锅', '厨房用具', 6800, 5000, '2026-1-15');
```

这时表会变成：

|product_id|product_name|product_type|sale_price|purchase_price|regist_date|
|---|---|---|---|---|---|
|0005|高压锅|厨房用具|6800|5000|2026-1-15|
|||||||
|||||||
|||||||

对表进行全列 INSERT 时，可以省略表名后的列清单。这时 VALUES子句的值会默认按照从左到右的顺序赋给每一列。

```SQL
INSERT INTO productins VALUES ('0005', '高压锅', '厨房用具', 6800, 5000, '2026-1-15');
```

|product_id|product_name|product_type|sale_price|purchase_price|regist_date|
|---|---|---|---|---|---|
|0005|高压锅|厨房用具|6800|5000|2026-1-15|
|||||||
|||||||
|||||||

**因为当你要插入全列时，数据库已经知道表有多少列、每列按什么顺序排列。你只要按同样顺序给出所有值，就可以不写列名。**插入数据后的效果和写列名是一样的。

原则上，执行一次 INSERT 语句会插入一行数据。插入多行时，通常需要循环执行相应次数的 INSERT 语句。很多 RDBMS 都支持一次插入多行数据：

```SQL
-- 通常的INSERT
INSERT INTO productins VALUES ('0002', '打孔器', '办公用品', 500, 320, '2009-09-11');
INSERT INTO productins VALUES ('0003', '运动T恤', '衣服', 4000, 2800, NULL);
INSERT INTO productins VALUES ('0004', '菜刀', '厨房用具', 3000, 2800, '2009-09-20');
-- 多行INSERT （ DB2、SQL、SQL Server、 PostgreSQL 和 MySQL多行插入）
INSERT INTO productins VALUES ('0002', '打孔器', '办公用品', 500, 320, '2009-09-11'),
                              ('0003', '运动T恤', '衣服', 4000, 2800, NULL),
                              ('0004', '菜刀', '厨房用具', 3000, 2800, '2009-09-20');  
```

可以使用INSERT … SELECT 语句从其他表复制数据。

```SQL
-- 把 product 表中的数据复制到 productcopy 表
INSERT INTO productcopy ((product_id, product_name, product_type, sale_price, purchase_price, regist_date)
SELECT product_id, product_name, product_type, sale_price, purchase_price, regist_date 
  FROM product; 

```

#### 1.3.5 索引

MySQL索引可以大大提高MySQL的检索速度。

索引创建了一种有序的数据结构，采用二分法搜索数据时，其复杂度为log2(N)，1000多万的数据只要搜索23次，其效率是非常高效的。

##### 1.3.5.1 如何创建索引

创建一张mytable 表，并在username列上创建普通索引。

```SQL
CREATE TABLE mytable (
    ID INT NOT NULL,
    username VARCHAR(16) NOT NULL,
    INDEX indexName (username) -- INDEX：声明要创建索引；indexName：索引名称；（username）表示索引建立在 username 列上
);
```

索引会帮助数据库更快查找用户名，例如：

```SQL
SELECT * FROM mytable WHERE username = 'alice';
```

但索引会占用额外存储空间，也需要在插入、修改和删除数据时维护。数据库优化器也会根据数据量和查询情况决定是否使用它，所以建立索引并不代表每次查询一定会更快。

也可以使用如下语句创建：

```SQL
-- 方法一
CREATE TABLE indexName ON mytable (username)
-- 方法二
ALTER TABLE mytable ADD INDEX indexName (username)
```

##### 1.3.5.2 索引分类

- 主键索引：建立在主键上的索引被称为主键索引，一张数据表只能有一个主键索引，索引列值不允许有空值，通常在创建表时一起创建。

- 唯一索引：建立在UNIQUE字段上的索引被称为唯一索引，一张表可以有多个索引

- 普通索引：建立在普通字段上的索引被称为普通索引

- 前缀索引：针对字符类型字段的前几个字符或者二进制类型字段的前几个bytes建立的索引，而不是在整个字段上建索引，可以大大减少索引占用的存储空间，也能提升索引的查询效率。

- 全文索引：利用分词技术实现在长文本中搜索关键字的一种索引

- 单列索引：建立在单个列上的索引被称为单列索引

- 联合索引：建立在多个列上的索引被称为联合索引

### 1.4 第一章课后习题

> 编写一条 CREATE TABLE 语句，用来创建一个包含表 1-A 中所列各项的表 Addressbook （地址簿），并为 regist_no （注册编号）列设置主键约束
> 
> 

![Image](assets/images/9b4ade198d/image-08.png)

```SQL
CREATE TABLE Addressbook (
    regist_no INTEGER NOT NULL,
    name VARCHAR(128) NOT NULL,
    address VARCHAR(256),
    tel_no CHAR(10), 
    mail_address CHAR(20),
    PRIMARY KEY (regist_no)
);
```

> 假设在创建练习1.1中的 Addressbook 表时忘记添加如下一列 postal_code （邮政编码）了，请编写 SQL 把此列添加到 Addressbook 表中。
> 
> 列名 ： postal_code
> 
> 数据类型 ：定长字符串类型（长度为 8）
> 
> 约束 ：不能为 NULL
> 
> 

错误示例❌️：把插入行数据和列数据的概念混淆：

```SQL
INSERT INTO Addressbook (postal_code) VALUES (CHAR(8), NOT NULL);
```

正确解法✅️：

```SQL
ALTER TABLE < 表名 > ADD COLUMN < 列的定义 >;
ALTER TABLE Addressbook ADD COLUMN postal_code CHAR(8) NOT NULL;
```

> 请补充如下 SQL 语句来删除 Addressbook 表。
> 
> 

```SQL
DROP TABLE Addressbook;
```

> 是否可以编写 SQL 语句来恢复删除掉的 Addressbook 表？
> 
> 

不能，DROP后的表是无法恢复的，只能重新插入



## 第二章 基础查询与排序

### 2.1 SELECT 语句基础

#### 2.1.1 从表中选取数据

从表中选取数据时需要使用 SELECT 语句，通过 SELECT 语句查询并选出必要数据的过程称为匹配查询或者查询（query）

```SQL
SELECT <列名>,
  FROM <表名>;
```

#### 2.1.2 从表中选出符合条件的数据

当不需要取出全部数据，而是选取满足某些条件的数据时，使用 WHERE 语句：

```SQL
SELECT <列名>, ……
  FROM <表名>
 WHERE <条件表达式>;
```

除此之外还有一些关于SELECT的语法：

```SQL
-- 想要查询出全部列时，可以使用代表所有列的星号（*）。
SELECT *
  FROM <表名>；
-- SQL语句可以使用AS关键字为列设定别名（用中文时需要双引号（“”））。
SELECT product_id     As id,
       product_name   As name,
       purchase_price AS "进货单价"
  FROM product;
-- 使用 `DISTINCT` 剔除 `product_type` 列中重复的数据
SELECT DISTINCT product_type
  FROM product;
```

### 2.2 算术运算符和比较运算符

```SQL
-- SQL语句中也可以使用运算表达式
SELECT product_name, sale_price, sale_price * 2 AS "sale_price x2"
  FROM product;
-- WHERE子句的条件表达式中也可以使用计算表达式
SELECT product_name, sale_price, purchase_price
  FROM product
 WHERE sale_price - purchase_price >= 500;
 
 -- 选取NULL的记录
SELECT product_name, purchase_price
  FROM product
 WHERE purchase_price IS NULL;
-- 选取不为NULL的记录
SELECT product_name, purchase_price
  FROM product
 WHERE purchase_price IS NOT NULL;
```

### 2.3 逻辑运算符

#### 2.3.1 NOT运算符

```SQL
SELECT product_name, product_type, sale_price 
  FROM product
 WHERE NOT sale_price >= 1000; -- 等价于 WHERE sale_price < 1000
```

虽然通过 NOT 运算符否定一个条件可以得到相反查询条件的结果，但是其可读性明显不如显式指定查询条件，因此，不可滥用该运算符。

#### 2.3.2 AND运算符和OR运算符

AND 表示取交集，OR 表示取并集

当二者冲突时候，使用括号来实现区分，括号内容的运算优先处理

```SQL
SELECT product_name, product_type, regist_date
  FROM product
 WHERE product_type = '办公用品' AND ( regist_date = '2026-01-21' OR regist_date = '2026-01-11');
```

运算符优先级请参考下图

![Image](assets/images/9b4ade198d/image-09.png)

#### 2.3.3 真值表

当碰到条件较复杂的语句时，理解语句含义并不容易，这时可以采用真值表来梳理逻辑关系。

![Image](assets/images/9b4ade198d/image-10.png)

简记口诀：

- AND 同真为真 一假则假

- OR 全假才假 其他都真

求解复杂的逻辑运算可以通过枚举构建真值表：

![Image](assets/images/9b4ade198d/image-11.png)

NULL的真值结果既不为真，也不为假，因为并不知道这样一个值。

这时真值是除真假之外的第三种值——不确定（UNKNOWN）。一般的逻辑运算并不存在这第三种值。SQL 之外的语言也基本上只使用真和假这两种真值。与通常的逻辑运算被称为二值逻辑相对，只有 SQL 中的逻辑运算被称为三值逻辑。

#### 2.3.4 课后习题

> 2.1 编写一条SQL语句，从 `product`(商品) 表中选取出“登记日期(`regist_date`)在2009年4月28日之后”的商品，查询结果要包含 `product_name` 和 `regist_date` 两列。
> 
> 

```SQL
SELECT product_name, regist_date
  FROM product
 WHERE regist_date > '2009-04-28'; -- 日期支持比大小
```

> 2.2 请说出对product 表执行如下3条SELECT语句时的返回结果。
> 
> 

```SQL
SELECT * FROM product WHERE purchase_price = NULL; 
SELECT * FROM product WHERE purchase_price <> NULL; 
SELECT * FROM product WHERE purchase_name > NULL; 
```

SQL 中 `NULL` 表示“未知/缺失”，不能用 `=`、`<>` 或 `>` 与它比较。这样的比较结果是 `UNKNOWN`，而 `WHERE` 只保留条件结果为 `TRUE` 的行。

> ```Plain Text
> SELECT product_name, sale_price, purchase_price
>   FROM product
>  WHERE sale_price - purchase_price >= 500;
> ```
> 
> 2.3 SELECT语句能够从 `product` 表中取出“销售单价（`sale_price`）比进货单价（`purchase_price`）高出500日元以上”的商品。请写出两条可以得到相同结果的SELECT语句。
> 
> 

```SQL
-- 方法一
SELECT sale_price, purchase_price
  FROM product
 WHERE NOT ( sale_price - purchase_price < 500);
 -- 方法二
 SELECT sale_price, purchase_price
  FROM product
 WHERE sale_price >= purchase_price + 500; -- WHERE sale_price - 500 >= purchase_price;
```

> 2.4 请写出一条SELECT语句，从 `product` 表中选取出满足“销售单价打九折之后利润高于 `100` 日元的**办公用品和厨房用具**”条件的记录。查询结果要包括 `product_name`列、`product_type` 列以及销售单价打九折之后的利润（别名设定为 `profit`）。
> 
> 

```SQL
SELECT product_name, product_type, sale_price * 0.9 - purchase AS profit
  FROM product
 WHERE profit - purchase_price > 100 AND ( product_type = '办公用品' OR product_type = '厨房用品'); -- 不要忘记还有条件！
```

### 2.4 对表进行聚合查询

#### 2.4.1 聚合函数

SQL中用于汇总的函数叫做聚合函数。以下五个是最常用的聚合函数：

- SUM：计算表中某数值列中的合计值

- AVG：计算表中某数值列中的平均值

- MAX：计算表中任意列中数据的最大值，包括文本类型和数字类型

- MIN：计算表中任意列中数据的最小值，包括文本类型和数字类型

- COUNT：计算表中的记录条数（行数）

```SQL
-- 计算总和
SELECT SUM(sale_price), SUM(purchase_price)
  FROM product;
-- 计算平均值
SELECT AVG(sale_price), AVG(purchase_price)
  FROM product;
-- 计算全部数据的行数（包含 NULL 所在行）
SELECT COUNT(*) FROM product
```

当对整表进行聚合运算时，表中可能存在多行相同的数据，在某些场景下，就不能直接使用聚合函数进行聚合运算了，必须搭配 `DISTINCT` 函数使用。假设 `product` 表如下：

比如要计算总共有几种饮品类型在售，如果直接执行 `SELECT COUNT(product_type) FROM product;`， `COUNT(列)` 统计的是 `product_type` 非 NULL 的行数，因此返回的是6，很明显把咖啡和茶都重复计算，因此需要DISTINCT：

```SQL
SELECT COUNT(DISTINCT product_type)
  FROM product;
```

#### 2.4.2 聚合函数应用法则

- COUNT(\<列名>) 得到不包含 NULL 值的所有行。

- 聚合函数不处理包含 NULL 值的行，但是 COUNT(*) 除外。

- MAX / MIN 函数适用于文本类型和数字类型的列，而 SUM / AVG 函数仅适用于数字类型的列。

- 在聚合函数的参数中使用 DISTINCT 关键字，可以得到删除重复值的聚合结果。

### 2.5 对表进行分组

2.5.1 GROUP BY 语句

当你想将进行分组汇总时（即：将现有的数据按照某列来汇总统计），GROUP BY可以帮助你：

```SQL
SELECT <列名1>,<列名2>, <列名3>, ……
  FROM <表名>
 GROUP BY <列名1>, <列名2>, <列名3>, ……;
```

比如：

```SQL
SELECT product_type, COUNT(*)
  FROM product
 GROUP BY product_type;
```

输出按照 product_type 分组，每种类型输出一行，`COUNT(*)` 统计的是该分组内的行数。

在 GROUP BY 子句中指定的列称为聚合键或者分组列。在上述例子中，`product_type `就叫做聚合键或者分组列。

GROUP BY 子句中不能使用 SELECT 子句中定义的别名。这是因为使用 GROUP BY 子句时SQL的执行顺序是：

```SQL
FROM -> WHERE -> GROUP BY -SELECT
```

SELECT 的执行顺序在 GROUP BY 之后，执行GROUP BY 时候还不知道 SELECT 中的别名。

当聚合键中包含NULL时，会将NULL作为一组特殊数据进行聚合运算。

如果想要筛选掉NULL的数据，在GROUP BY之前加一条WHERE语句：

```SQL
SELECT product_type, COUNT(*)
  FROM product
 WHERE product IS NOT NULL
 GROUP BY product_type;
```

### 2.6 为聚合结果指定条件

#### 2.6.1 用HAVING得到特定分组

![Image](assets/images/9b4ade198d/image-12.png)

将表使用GROUP BY 分组后，如果只想取出其中两组，如何实现？

使用WHERE加约束条件不可取，因为WHERE子句只能指定记录（行）的条件，而不能用来指定 GROUP里的条件。

可以在 GROUP BY 后配合使用 HAVING 子句。

#### 2.6.2 HAVING 语句的特点

HAVING 子句可以使用常数、聚合函数和GROUP BY 中指定的列名（聚合键）

```SQL
-- 取出 GROUP BY 分组后行数为2的的组
SELECT product_type, COUNT(*)
  FROM product
 GROUP BY product_type
HAVING COUNT(*) = 2;

-- 取出 GROUP BY 分组后 product_type = '饮料' 的组
SELECT product_type, COUNT(*)
  FROM product
 GROUP BY product_type
HAVING product_type = '饮料';
```

输出为：

### 2.7 对查询结果进行排序

#### 2.7.1 ORDER BY

在某些场景下，需要得到升序或者降序后的排序结果，而SQL语句执行结果默认随机排序，想要按照顺序排序，需要使用 ORDER BY 子句

```SQL
SELECT <列名1>, <列名2>, <列名3>, ……
  FROM <表名>
 ORDER BY <排序基准列1> [ASC, DESC], <排序基准列2> [ASC, DESC], ……
```

其中 ASC 表示升序排列，DESC 表示降序排列，默认为升序排列。

```SQL
-- 将销售价格倒序排列
SELECT product_id, product_name, sale_price, purchase_price
  FROM product
 ORDER BY sale_price DESC;
```

特别地，NULL无法进行排序，因此当排序列存在NULL值时，NULL 结果会展示在查询结果的开头或者末尾。

#### 2.7.2 ORDER BY 子句中使用别名

和GROUP BY 语句不同，在 ORDER BY 中可以使用 SELECT 语句中的别名。

这是因为 SQL 执行带有 ORDER BY 子句的指令时，执行顺序是：

```SQL
FROM -> WHERE -> GROUP BY -> HAVING-> SELECT -> ORDER
```

以上表为例，执行以下语句：

```SQL
SELECT   要输出的列 / 聚合函数
FROM     表名
WHERE    分组前过滤原始行
GROUP BY 分组列
HAVING   分组后过滤组
ORDER BY 排序表达式 ASC|DESC;
```

```SQL
SELECT product_type,
       COUNT(*) AS product_count,
       SUM(sale_price) AS total_sale_price
FROM product
WHERE purchase_price IS NOT NULL
GROUP BY product_type
HAVING COUNT(*) >= 2
ORDER BY product_count DESC;
```

可视化流程就是：

![Image](assets/images/9b4ade198d/image-13.png)

#### 2.7.2 ORDER BY 遇上NULL

MySQL中，`NULL` 值被认为比任何 `非NULL` 值低，因此，当顺序为 ASC（升序）时，`NULL` 值出现在第一位，而当顺序为 DESC（降序）时，则排序在最后。

如果想指定存在 `NULL` 的行出现在首行或者末行，需要特殊处理。



#### 2.7.3 课后习题

> 2.5 请指出下述SELECT语句中所有的语法错误。
> 
> SELECT product_id, SUM（product_name）
> 
> --本SELECT语句中存在错误。
> 
> FROM product
> 
> GROUP BY product_type
> 
> WHERE regist_date > '2009-09-01';
> 
> 

错误一：WHERE 子句应该放在 GROUP BY 子句之前

错误二：product_name 是字符串类型，不能对字符串类型进行求和

错误三：SELECT 后面的 product_id 没有被聚合函数包裹，属于是非聚合列，但是没有出现在 GROUP BY 后面

> 2.6 请编写一条SELECT语句，求出销售单价（ `sale_price` 列）合计值大于进货单价（ `purchase_price` 列）合计值1.5倍的商品种类。执行结果如下所示。
> 
> ![Image](assets/images/9b4ade198d/image-14.png)
> 
> 

错误写法❌️：

```SQL
SELECT SUM(sale_price) AS total_sale_price, 
       SUM(purchase_price) AS total_purchase_price
  FROM product
 WHERE total_sale_price > total_purchase_price
 GROUP BY product_type
```

错误点一：混淆了SQL的执行顺序，WHERE是对FROM 后第二执行的，是对

原始数据行进行过滤的，因此此时total_sale_price 和 total_purchase_pricetal 还没有被计算出来

错误点二：WHERE中不能使用 SELECT 定义的别名，同理是因为执行顺序的问题， WHERE 先于 SELECT 执行

错误点三：GROUP BY 后面的列没有出现在 SELECT 后面

正确写法✅️：

```SQL
SELECT product_type, SUM(sale_price), SUM(purchase_price)
  FROM product
 GROUP BY product_type
 HAVING SUM(sale_price) > SUM(purchase_price) * 1.5;
```

正确解法的执行顺序是 FROM  -> GROUP BY -> HAVING -> SELECT

先对于 product_type 进行分组，得到HAVING子句可以调用聚合函数计算给出SUM(sale_price) > SUM(purchase_price) * 1.5的分组，对于那些在 HAVING 中存活下来的组，SELECT 才开始提取 `product_type`，并再次计算 `SUM(...)` 作为最终的输出列展示给你。



> 2.7 此前我们曾经使用SELECT语句选取出了product（商品）表中的全部记录。当时我们使用了 `ORDER BY` 子句来指定排列顺序，但现在已经无法记起当时如何指定的了。请根据下列执行结果，思考 `ORDER BY` 子句的内容。
> 
> ![Image](assets/images/9b4ade198d/image-15.png)
> 
> 



错误解法❌️：

观察每一列的数据特征，只有 regist_date 这一列有明显的降序排列特征，因此：

```SQL
ORDER BY regist_date DESC;
```

正确解法✅️：

忽略了在日期相同时候，sale_price是按照升序排列的，同时还应该注意到在regist_date列第一位行的是NULL，在大多数数据库中NULL 被视为无限大，也符合regist_date降序排列的特征，因此：

```SQL
SELECT *
  FROM product
 ORDER BY regist_date DESC, sale_price ASC
```

## 第三章 复杂一点的查询

### 3.1 视图

```SQL
SELECT product_name
  FROM view_product;
```

单看这个语句和从view_product表中查询数据是完全相同的，但是实际上我们操作的是一个视图。

#### 3.1.1 什么是视图

视图是一个虚拟的表，不同于直接操作数据表，视图是依据SELECT语句来创建，所以操作视图时会根据创建视图的SELECT语句生成一张虚拟表，然后在这张虚拟表上做SQL操作。

对于视图和表的区别在于“是否保存了实际的数据”，所以视图并不是数据库真实存储的数据表，它可以看作一个窗口，通过这个窗口可以看到数据库表中真实的数据。

一句话总结就是，视图是基于真实表的一张虚拟表，其数据来源建立在真实表的基础上。

![Image](assets/images/9b4ade198d/image-16.png)

#### 3.1.2 视图的必要性

那既然已经有数据表了，为什么还需要视图呢，视图主要有以下作用：

- 通过定义视图可以将频繁使用过的SELECT语句保存以提高效率

- 通过定义视图可以使用户看到的数据更加清晰：可以定义一个视图把底层的表数据翻译成清晰易懂的视图输出

- 通过定义视图可以不对外公开数据表的全部字段，增强数据的保密性：可以把底层的表中的敏感数据锁死，而只是把新建的视图的查询权限开放给用户

- 通过定义视图可以降低数据的冗余：视图不实际存储数据，只是负责查询数据，当查询视图时，数据库会实时去底层表拉取数据，不需要为了不同的业务而复制底层表很多分，只需要建立不同的视图就能满足各种需求

#### 3.1.3 创建视图

创建视图的基本语法如下：

```SQL
CREATE VIEW <视图名称>(<列名1>,<列名2>,...) AS <SELECT语句>
```

SELECT 语句中的第 1 列就是视图中的第 1 列， SELECT 语句中的第 2 列就是视图中的第 2 列，以此类推。 需要注意的是视图名在数据库中需要是唯一的，不能与其他视图和表重名。

视图不仅可以基于真实表，我们也可以在视图的基础上继续创建视图。

![Image](assets/images/9b4ade198d/image-17.png)

虽然在视图上继续创建视图的语法没有错误，但是我们还是应该尽量避免这种操作。这是因为对多数 DBMS 来说， 多重视图会降低 SQL 的性能。

- 基于单表的视图

我们在product表的基础上创建一个视图：

```SQL
CREATE VIEW productsum (product_type, cnt_product) AS 
SELECT product_type, COUNT(*)
  FROM product
 GROUP BY product_type;
```

创建的视图如下所示：

![Image](assets/images/9b4ade198d/image-18.png)

- 基于多表的视图

```SQL
CREATE VIEW view_shop_product (product_type, sale_price, shop_name)
AS
SELECT 
    product.product_type, 
    product.sale_price, 
    shop_product.shop_name  -- 假设 shop_name 在 shop_product 表中
FROM product
JOIN shop_product -- JOIN 表示把两张或更多表连起来，连接规则是 ON 后面的语句
  ON product.product_id = shop_product.product_id;
```

#### 3.1.4 修改视图结构

修改视图结构的基本语法如下：

```SQL
ALTER VIEW <视图名> AS <SELECT语句>
```

比如：

```SQL
ALTER VIEW productsum AS
SELECT product_type, sale_price
  FROM product
 WHERE regist_date > '2009-09-11'
```

此时 productsum 的视图内容被修改：

![Image](assets/images/9b4ade198d/image-19.png)

#### 3.1.5 更新视图内容

```SQL
UPDATE 视图名
   SET 列名 = 新值
 WHERE 条件;
```

对视图执行 `UPDATE`，实际上是在更新它底层的基表。但是并不是所有的视图都不能被更新，通常必须满足以下条件：

1. 没有使用聚合函数（如 `SUM()`、`COUNT()`、`AVG()`、`MAX()`、`MIN()`）。

2. 没有使用 `GROUP BY` 或 `HAVING`。

3. 没有使用 `DISTINCT`（去重）。

4. 没有使用多表连接（JOIN）。*(注：某些数据库允许简单的 INNER JOIN 视图更新，但这非常容易引发歧义，标准 SQL 和多数学派建议：单表视图才更新)*。

5. `SELECT` 子句中不能包含计算表达式（如 `sale_price * 2`）。

6. 视图必须包含底层基表的所有非空列（NOT NULL）。

#### 3.1.6 删除视图

```SQL
DROP VIEW <视图名>
DROP VIEW productsum -- 必须有相应的权限才能成功删除视图
```

#### 3.1.7 查看视图

通过如下命令查看 shop 数据库下的所有视图

```SQL
-- 方法一
SHOW FULL TABLES WHERE Table_type = 'VIEW'
-- 方法二
SELECT TABLE_NAME
  FROM information_schema.VIEWS -- information_schema 是 MySQL自带的数据字典，
  -- VIEWS表专门记录了所有视图的定义信息
 WHERE TABLE_SCHEMA = 'shop'
```

### 3.2 子查询

#### 3.2.1 什么是子查询

子查询是一个查询语句嵌套在另一个查询语句内部的查询，在 SELECT 子句中先计算子查询，子查询结果作为外层另一个查询的过滤条件，查询可以基于一个表或者多个表。

#### 3.2.2 子查询和视图的关系

假设我们要从 `product` 表中，找出销售单价（sale_price）高于所有商品平均销售单价的商品。

如果用子查询：

```SQL
SELECT product_name, sale_price
  FROM product
 WHERE sale_price > (SELECT AVG(sale_price) FROM product);
```

这里的 `(SELECT AVG(sale_price) FROM product)`就是一个子查询。它先计算出平均值，然后外层查询拿着这个值再去筛选。

如果用视图：

```SQL
-- 第一步：创建视图
CREATE VIEW view_avg_price AS
 SELECT AVG(sale_price) AS avg_price
  FROM product;
  
-- 第二步：使用视图作为过滤条件
SELECT product_name, sale_price
  FROM product
 WHERE sale_price > (SELECT avg_price FROM view_avg_price);
```

子查询存在于内存中，是临时的，一旦这条 SELECT 语句执行完毕，这个子查询的结果就消失了。视图是数据库中的一个实体对象，查询语句被保存了下来，下次用直接 `SELECT * FROM 视图名` 即可

#### 3.2.3 嵌套子查询

虽然嵌套子查询可以查询出结果，但是随着子查询嵌套的层数的叠加，SQL语句不仅会难以理解而且执行效率也会很差，所以要尽量避免这样的使用。

#### 3.2.4 标量子查询

标量就是单一的意思，所谓单一就是要求我们执行的SQL语句只能返回一个值，也就是要返回表中具体的某一行的某一列。

```SQL
SELECT product_id, product_name, sale_price
  FROM product
 WHERE sale_price > (SELECT AVG(sale_price) FROM product);
```

由于标量子查询的特性，导致标量子查询不仅仅局限于 WHERE 子句中，通常任何可以使用单一值的位置都可以使用。

#### 3.2.5 关联子查询

关联子查询就是通过一些标志将内外两层的查询连接起来起到过滤数据的目的，比如：

```SQL
SELECT product_type, product_name, sale_price
  FROM product AS p1 -- 将外层的 product 命名为 p1
 WHERE sale_price > (SELECT AVG(sale_price)
                       FROM product AS p2 -- 将内层的 product 命名为 p2
                      WHERE p1.product_type = p2.product_type -- 只计算 p2 中种类等于 p1 当前行种类的那些数据
                      GROUP BY product_type);
```

真正执行的时候数据库先读取外层 p1 的第一行，然后拿着第一行的 sale_price 去扫描 p2 中 p1.product_type = p2.product_type 的 sale_price 再计算AVG，以此类推再读取外层 p2 的第二行。外层有几行，子查询就要进行多少次，时间复杂度是O(N^2)，为了优化它，现在SQL引入了窗口函数来替代。

#### 3.2.6 课后习题

> 3.1 
> 
> 创建出满足下述三个条件的视图（视图名称为 ViewPractice5_1）。使用 product（商品）表作为参照表，假设表中包含初始状态的 8 行数据。
> 
> - 条件 1：销售单价大于等于 1000 日元。
> 
> - 条件 2：登记日期是 2009 年 9 月 20 日。
> 
> - 条件 3：包含商品名称、销售单价和登记日期三列。
> 
> 对该视图执行 SELECT 语句的结果如下所示。
> 
> SELECT * FROM ViewPractice5_1;
> 
> 执行结果
> 
> ![Image](assets/images/9b4ade198d/image-20.png)
> 
> 

错误写法❌️：WHERE 语句里面连接多个条件，不能用逗号，而是要用逻辑运算符

```SQL
CREATE VIEW ViewPractice5_1 (product_name, sale_price, regist_date) 
AS
SELECT product_name, sale_price, regist_date
  FROM product
 WHERE sale_price >= 1000,
       regist_date = '2009-09-20';
```

正确写法✅️：

```SQL
CREATE VIEW ViewPractice5_1 (product_name, sale_price, regist_date) 
AS
SELECT product_name, sale_price, regist_date
  FROM product
 WHERE sale_price >= 1000
       AND regist_date = '2009-09-20';
```



> 3.2 
> 
> 向习题一中创建的视图 `ViewPractice5_1` 中插入如下数据，会得到什么样的结果？为什么？
> 
> INSERT INTO ViewPractice5_1 VALUES (' 刀子 ', 300, '2009-11-02');
> 
> 

错误回答❌️：

视图和原表都增加了一行数据，因为视图是基于表的，二者要对应

正确回答✅️：

插入时将会报错，视图插入数据时候，原表也会插入数据，但是原表插入时候必须满足 product_id IS NOT NULL, product_name IS NOT NULL, product_type IS NULL，很明显插入的数据不满足格式，所以会报错

---

> 3.3 请根据如下结果编写 SELECT 语句，其中 sale_price_avg 列为全部商品的平均销售单价。
> 
> ![Image](assets/images/9b4ade198d/image-21.png)
> 
> 

错误写法❌️：

```SQL
SELECT product_id, 
       product_name, 
       product_type, 
       sale_price, 
       AVG(sale_price)
 FROM product;
```

正确写法✅️：

考察的是嵌套子查询，sale_price_avg 是由原表的 sale_price 取平均值得到的，这个过程就是子查询：

```SQL
SELECT product_id, 
       product_name, 
       product_type, 
       sale_price, 
       (SELECT AVG(sale_price) FROM product) AS sale_price_avg
 FROM product;
```

---

> 3.4 编写一条 SQL 语句，创建一幅包含如下数据的视图（名称为AvgPriceByType）。
> 
> ![Image](assets/images/9b4ade198d/image-22.png)
> 
> 

首先观察目标视图中包含了五列，除了最后一项 sale_price_avg_type 都来自于原表：  

```SQL
CREATE VIEW AvgPriceByType (product_id, product_name, product_type, sale_price, sale_price_avg_type)
AS
SELECT product_id,
       product_name,
       prodcut_type,
       sale_price,
       -- 这里放子查询
FROM product ...
```

然后看习题一中的条件，是对原始行进行过滤的，因此需要写在外层的 WHERE里面。

```SQL
CREATE VIEW AvgPriceByType (product_id, product_name, product_type, sale_price, sale_price_avg_type)
AS
SELECT product_id,
       product_name,
       prodcut_type,
       sale_price,
       -- 这里放子查询
FROM product 
WHERE sale_price >= 1000
      regist_date = '2009-09-20'
```

然后就是写子查询：

```SQL
(SELECT AVG(sale_price)
FROM product AS p2
WHERE p1.product_type = p2.product_type
GROUP BY product_type;
)
```

合在一起就是：

```SQL
CREATE VIEW AvgPriceByType (product_id, product_name, product_type, sale_price, sale_price_avg_type)
AS
SELECT product_id,
       product_name,
       product_type,
       sale_price,
       (SELECT AVG(sale_price)
        FROM product AS p2
        WHERE p1.product_type = p2.product_type
        )
FROM product AS p1;
```

---

### 3.3 各种各样的函数

SQL自带了各种各样的函数，极大提高了SQL语言的便利性

函数大致分为如下几类：

- 算术函数 （用来进行数值计算的函数）

- 字符串函数 （用来进行字符串操作的函数）

- 日期函数 （用来进行日期操作的函数）

- 转换函数 （用来转换数据类型和值的函数）

- 聚合函数 （用来进行数据聚合的函数）

#### 3.3.1 算术函数

ABS：绝对值；`MOD( 被除数，除数 )`：求余数；`ROUND( 对象数值，保留小数的位数 )`：四舍五入

#### 3.3.2 字符串函数

`CONCAT(str1, str2, str3)`：拼接字符串

`LENGTH( 字符串 )`：求长度

`REPLACE( 对象字符串，替换前的字符串，替换后的字符串 )`：字符串替换

`SUBSTRING （对象字符串 FROM 截取的起始位置 FOR 截取的字符数）`：截取字符串

`REPEAT(string, number)`：字符串按需重复多少次

#### 3.3.3 日期函数

- CURRENT_DATE -- 获取当前日期

- CURRENT_TIME -- 当前时间

- CURRENT_TIMESTAMP -- 当前日期和时间

- E`XTRACT(日期元素 FROM 日期)`：例如 `EXTRACT(YEAR   FROM CURRENT_TIMESTAMP) AS year`

#### 3.3.4 转换函数

- `CAST（转换前的值 AS 想要转换的数据类型）`：需要特别注意的是，当要转换为整型时，需要指定为 SIGNED（有符号） 或者 UNSIGNED（无符号）

- `COALESCE(数据1，数据2，数据3……)`：COALESCE 是 SQL 特有的函数。该函数会返回可变参数 A 中左侧开始第 1个不是NULL的值。

例如：

```SQL
SELECT COALESCE(NULL, 11) AS col_1,
COALESCE(NULL, 'hello world', NULL) AS col_2,
COALESCE(NULL, NULL, '2020-11-01') AS col_3;
+-------+-------------+------------+
| col_1 | col_2       | col_3      |
+-------+-------------+------------+
|    11 | hello world | 2020-11-01 |
+-------+-------------+------------+
1 row in set (0.00 sec)
```

### 3.4 谓词

谓词就是返回值为真值的函数。包括`TRUE / FALSE / UNKNOWN`。

#### 3.4.1 LIKE 谓词：用于字符串的部分一致查询

- 前方一致：选取出“dddabc”

```SQL
SELECT *FROM samplelike
WHERE strcol LIKE 'ddd%';
```

- 中间一致

```SQL
SELECT *FROM samplelike
WHERE strcol LIKE '%ddd%';
```

- 后方一致

```SQL
SELECT *FROM samplelike
WHERE strcol LIKE '%ddd';
```

- `_`下划线匹配任意 1 个字符

```SQL
SELECT *FROM samplelike
WHERE strcol LIKE 'abc__';
```

#### 3.4.3 BETWEEN 谓词：用于范围查询

使用 BETWEEN 可以进行范围查询。该谓词与其他谓词或者函数的不同之处在于它使用了 3 个参数。

```SQL
SELECT product_name, sale_price
FROM product
WHERE sale_price BETWEEN 100 AND 1000;
```

BETWEEN 的特点就是结果中会包含 100 和 1000 这两个临界值，也就是闭区间。如果不想让结果中包含临界值，那就必须使用 \< 和 >。

3.4.5 IN 谓词

```SQL
SELECT product_name, purchase_price
FROM product
WHERE purchase_price = 320
    OR purchase_price = 500
    OR purchase_price = 5000;
```

但是随着希望选取的对象越来越多，OR语句会越来越长，因此采用IN 谓词可以进行简化表示：

```SQL
SELECT product_name, purchase_price
FROM product
WHERE purchase_price IN (320, 500, 5000);
```

需要注意的是，在使用IN 和 NOT IN 时是无法选取出NULL数据的。

#### 3.4.6 使用子查询作为 IN 谓词的参数

```SQL
SELECT product_name, sale_price
FROM product
WHERE product_id IN (SELECT product_id
                       FROM shopproduct
                       WHERE shop_id = '000C');
```

子查询从内层开始执行：

```SQL
SELECT product_name, sale_price
FROM product
WHERE product_id IN ('0003', '0004', '0006', '0007');
```

#### 3.4.7 EXIST 谓词

EXIST 不关心子查询查出了什么数据，只关心子查询“有没有查出数据”。只要子查询结果集里哪怕只有一行记录，`EXISTS` 就返回 `TRUE`；如果一行都没有，就返回 `FALSE`。EXIST 通常要用关联子查询：

```SQL
SELECT * 
  FROM product AS p1
 WHERE EXISTS (SELECT 1 
                 FROM shop_product AS p2 
                WHERE p1.product_id = p2.product_id);
```

因为 EXISTS 判断有没有，不用它返回值，所以在子查询里写 `SELECT *`、`SELECT product_id` 还是 `SELECT 1` 甚至 `SELECT 'Hello'`，执行效率和对结果的影响完全一样。

只要找到一条 `p1.product_id = p2.product_id`匹配的记录 EXIST 就返回 TRUE。

### 3.5 CASE 表达式

```SQL
CASE WHEN <求值表达式> THEN <表达式>
     WHEN <求值表达式> THEN <表达式>
     WHEN <求值表达式> THEN <表达式>
     .
     .
     .
ELSE <表达式>
END  
```

上述语句执行时，依次判断 when 表达式是否为真值，是则执行 THEN 后的语句，如果所有的 when 表达式均为假，则执行 ELSE 后的语句。 无论多么庞大的 CASE 表达式，最后也只会返回一个值。

```SQL
SELECT  product_name,
        CASE WHEN product_type = '衣服' THEN CONCAT('A ： ',product_type)
             WHEN product_type = '办公用品'  THEN CONCAT('B ： ',product_type)
             WHEN product_type = '厨房用具'  THEN CONCAT('C ： ',product_type)
             ELSE NULL
        END AS abc_product_type
  FROM  product;
+--------------+------------------+
| product_name | abc_product_type |
+--------------+------------------+
| T恤          | A ： 衣服        |
| 打孔器       | B ： 办公用品    |
| 运动T恤      | A ： 衣服        |
| 菜刀         | C ： 厨房用具    |
| 高压锅       | C ： 厨房用具    |
| 叉子         | C ： 厨房用具    |
| 擦菜板       | C ： 厨房用具    |
| 圆珠笔       | B ： 办公用品    |
+--------------+------------------+
```

还有一个很实用的场景是行转列：

比如要将

实现行转列：

```SQL
SELECT name,
        SUM(CASE WHEN subject = '语文' THEN score ELSE NULL END) AS chinese,
        SUM(CASE WHEN subject = '数学' THEN score ELSE NULL END) AS math,
        SUM(CASE WHEN subject = '外语' THEN score ELSE NULL END) AS english
      FROM score
GROUP BY name;
```

### 3.6 课后习题

> 3.5 判断题：四则运算中含有 NULL 时（不进行特殊处理的情况下），运算结果是否必然会变为NULL ？
> 
> 

在标准 SQL 中，有一个非常核心的规则：NULL 代表“未知”或“缺失”。你拿一个未知的数去做任何四则运算（+、-、*、/），结果依然是未知的（即 NULL）。



> 3.6 
> 
> 对本章中使用的 `product`（商品）表执行如下 2 条 `SELECT` 语句，能够得到什么样的结果呢？
> 
> ①
> 
> SELECT product_name, purchase_price
> 
> FROM product
> 
> WHERE purchase_price NOT IN (500, 2800, 5000);
> 
> ②
> 
> SELECT product_name, purchase_price
> 
> FROM product
> 
> WHERE purchase_price NOT IN (500, 2800, 5000, NULL);
> 
> 

原表：

运行完指令一：

错误回答❌️：

正确回答✅️： IN 谓词无法与 NULL 比较，所以也不包含含 NULL的

运行完指令二：

错误回答❌️：

正确回答✅️：

返回零条记录，因为 NOT IN 的参数中不能含有 NULL，否则结果通常为空

---

> 3.7 
> 
> 按照销售单价( `sale_price` )对练习 3.6 中的 `product`（商品）表中的商品进行如下分类。
> 
> - 低档商品：销售单价在1000日元以下（T恤衫、办公用品、叉子、擦菜板、 圆珠笔）
> 
> - 中档商品：销售单价在1001日元以上3000日元以下（菜刀）
> 
> - 高档商品：销售单价在3001日元以上（运动T恤、高压锅）
> 
> 请编写出统计上述商品种类中所包含的商品数量的 SELECT 语句，结果如下所示。
> 
> 执行结果
> 
> low_price | mid_price | high_price
> 
> ----------+-----------+------------
> 
> 5 |         1 |         2
> 
> 

观察目标输出结果，原始的表里每一行是一个商品，而结果要求输出只有一行，包含三个全新的列。整体的框架应该是这样的：

```SQL
SELECT 
    /* 计算低档商品数量的表达式 */ AS low_price,
    /* 计算中档商品数量的表达式 */ AS mid_price,
    /* 计算高档商品数量的表达式 */ AS high_price
FROM product;
```

然后需要填充表达式

错误写法❌️：不支持连续比较，需要用 AND 连接或者 BETWEEN 谓词

```SQL
SELECT 
    SUM(CASE WHEN sale_price <= 1000 THEN 1 ELSE 0 END) 
    AS low_price,
    SUM(CASE WHEN 1000 < sale_price <= 3000 THEN 1 ELSE 0 END) AS mid_price,
    SUM(CASE WHEN 3000 < sale_price THEN 1 ELSE 0 END) AS high_price
FROM product;
```

正确写法✅️：

```SQL
-- 写法一
SELECT 
    SUM(CASE WHEN sale_price <= 1000 THEN 1 ELSE 0 END) 
    AS low_price,
    SUM(CASE WHEN sale_price > 1000 AND sale_price <= 3000 THEN 1 ELSE 0 END) AS mid_price,
    SUM(CASE WHEN sale_price > 3000 THEN 1 ELSE 0 END) AS high_price
FROM product;

-- 写法二
SELECT 
    SUM(CASE WHEN sale_price <= 1000 THEN 1 ELSE 0 END) 
    AS low_price,
    SUM(CASE WHEN sale_price BETWEEN 1001 AND 3000 THEN 1 ELSE 0 END) AS mid_price,
    SUM(CASE WHEN sale_price > 3000 THEN 1 ELSE 0 END) AS high_price
FROM product;
```

## 第四章 集合运算

### 4.1 表的加减法

#### 4.1.1 表的加法：UNION

```SQL
SELECT product_id, product_name
  FROM product
 UNION
SELECT product_id, product_name
  FROM product2;
```

![Image](assets/images/9b4ade198d/image-23.png)

实际上就是我们学过的并集，UNION 等集合运算符通常都会除去重复的记录。

##### 4.1.1.1 UNION 与 OR 谓词

对于同一个表使用 UNION 对两个查询结果取并集效果和使用 OR 谓词连接两个查询条件是一致的。比如：

```SQL
-- 对同一个表的两个查询结果取并集 UNION:
SELECT  product_id,product_name,product_type
       ,sale_price,purchase_price
  FROM product 
 WHERE sale_price<800
  
 UNION
 
SELECT  product_id,product_name,product_type
       ,sale_price,purchase_price
  FROM product 
 WHERE sale_price>1.5*purchase_price;

 -- 使用 OR 谓词连接两个条件:
SELECT  product_id,product_name,product_type
       ,sale_price,purchase_price
  FROM product 
 WHERE sale_price < 800 
    OR sale_price > 1.5 * purchase_price;
```

但是要将两个不同的表中的结果合并在一起，就必须使用 UNION

##### 4.1.1.2 包含重复行的并集运算：UNION ALL

在实践中有时候需要不去重的并集，在 UNION 的结果中保留重复行的语法其实非常简单，只需要在 UNION 后面添加 ALL 关键字就可以了。

```SQL
-- 保留重复行
SELECT product_type
  FROM product
 UNION ALL
SELECT product_type
  FROM product2;
```

#### 4.1.2 交集运算符

在 MySQL 中，直到 8.0.31 版本才正式原生支持 `INTERSECT`（在此之前只能用 `INNER JOIN` 或 `IN` 来模拟）。而在 PostgreSQL、SQL Server、Oracle 中，它是早就标配的功能。

```SQL
SELECT product_id, product_name FROM product
INTERSECT
SELECT product_id, product_name FROM product2;
```

`INTERSECT` 上下两个 `SELECT` 语句的列数必须相同，且对应列的数据类型必须兼容。和 UNION 一样可以自动去重。

#### 4.1.3 差集补集和表的减法

差集用 EXCEPT：

```SQL
SELECT product_id FROM product
EXCEPT
SELECT product_id FROM product2;
```

补集通常是用 NOT EXISTS 语句实现：

查询在 `product` 表中，但不在 `product2` 表中的 `product_id`：

```SQL
SELECT p1.product_id 
  FROM product p1
 WHERE NOT EXISTS (SELECT 1 
                     FROM product2 p2 
                    WHERE p1.product_id = p2.product_id);
```

#### 4.1.4 对称差

两个集合 A、B 的对称差是指那些仅属于A或仅属于B的元素构成的集合。对称差也是个非常基础的运算，例如，两个集合的交就可以看作是两个集合的并去掉两个集合的对称差。上述方法在其他数据库里也可以用来简单地实现表或查询结果的对称差运算: 首先使用UNION求两个表的并集，然后使用 INTERSECT 求两个表的交集，然后用并集减去交集，就得到了对称差。

### 4.2 连结（JOIN）

在 4.1 我们学习了 UNION 和 INTERSECT 等集合运算，这些集合运算的特征本质上是以行方向为单位进行操作。通俗的说这些集合操作会让合并或者拓展行。但是这些运算不能改变列的变化，虽然使用函数或者 CASE 表达式等列运算可以增加列的数量，但是只能从一张表中获得一些“引申列”，本质上不能提供更多的信息。如果想**从多个表**获得信息，需要使用 JOIN：

![Image](assets/images/9b4ade198d/image-24.png)

#### 4.2.1 内连结（INNER JOIN）

内连结 的语法格式是：

```SQL
FROM <table_1> INNER JOIN <table_2> ON <condition(s)>
```

product 表保存了商品编号，商品名称，商品种类等信息，这个表可以提供关于衣服种类的衣服的详细信息，但是不能提供商店信息:

![Image](assets/images/9b4ade198d/image-25.png)

shopproduct 表，这个表里有商店编号名称，商店的商品编号及数量。但要想获取商品的种类及名称售价等信息，则必须借助于 product 表:

![Image](assets/images/9b4ade198d/image-26.png)

我们来对比一下上述两张表，可以发现，**商品编号列是一个公共列，因此很自然的事情就是用这个商品编号列来作为连接的“桥梁”**，将product和shopproduct这两张表连接起来。

```SQL
SELECT SP.shop_id,
       SP.shop_name,
       SP.product_id,
       P.product_name,
       P.product_type,
       P.sale_price,
       SP.quantity
  FROM shopproduct AS SP
 INNER JOIN product AS P
    ON SP.product_id = P.product_id;
```

上述查询会得到如下结果：

![Image](assets/images/9b4ade198d/image-27.png)

##### 4.2.1.1  结合 WHERE 子句使用内连结

还可以结合 WHERE 子句使用内连结，可以把以上查询作为子查询，用括号封装起来，然后在外层查询增加筛选条件。

```SQL
SELECT   SP.shop_id,
         SP.shop_name,
         SP.product_id,
         P.product_name,
         P.product_type,
         P.sale_price,
         SP.quantity
    FROM shopproduct AS SP
 INNER JOIN product AS P
      ON SP.product_id = P.product_id) AS STEP1
 WHERE shop_name = '东京'
   AND product_type = '衣服';
```

在结合 WHERE 子句使用内连结的时候，我们也可以更改任务顺序，并采用任务分解的方法，先分别在两个表使用 WHERE 进行筛选，然后把上述两个子查询连结起来。

```SQL
SELECT SP.shop_id
       ,SP.shop_name
       ,SP.product_id
       ,P.product_name
       ,P.product_type
       ,P.sale_price
       ,SP.quantity
  FROM (-- 子查询 1:从 shopproduct 表筛选出东京商店的信息
        SELECT *
          FROM shopproduct
         WHERE shop_name = '东京' ) AS SP
 INNER JOIN -- 子查询 2:从 product 表筛选出衣服类商品的信息
   (SELECT *
      FROM product
     WHERE product_type = '衣服') AS P
    ON SP.product_id = P.product_id;
```

练习题：

找出每个商店里的衣服类商品的名称及价格等信息，希望得到如下结果：

![Image](assets/images/9b4ade198d/image-28.png)

```SQL
SELECT 
        SP.shop_id,
        SP.shop_name,
        SP.product_id,
        P.product_name,
        P.product_type,
        P.purchase_price
   FROM shopproduct AS SP
  INNER JOIN (SELECT
                      product_id,
                      product_name,
                      product_type,
                      purchase_price
                 FROM porduct
               WHERE product_type = '衣服') AS P
    ON SP.product_id = P.product_id;  
```

练习题：

分别使用连结两个子查询和不使用子查询的方式，找出东京商店里，售价低于 2000 的商品信息，希望得到如下结果。

![Image](assets/images/9b4ade198d/image-29.png)

```SQL
SELECT SP.*, P.*
  FROM shopproduct AS SP
INNER JOIN product AS P
    ON SP.product_id = P.product_id
 WHERE shop_id = '000A'
 AND sale_price < 2000
```

##### 4.2.1.2  结合 GROUP BY 子句使用内连结

每个商店中，售价最高的商品的售价分别是多少？

```SQL
-- 参考答案
SELECT SP.shop_id
      ,SP.shop_name
      ,MAX(P.sale_price) AS max_price
  FROM shopproduct AS SP
 INNER JOIN product AS P
    ON SP.product_id = P.product_id
 GROUP BY SP.shop_id,SP.shop_name;
```



#### 4.2.2 外连结（OUTER JOIN）

总有一个表是主要的，必须全部保留。如果另一方没有匹配的数据，就填 `NULL`。

三种外连结的对应语法分别为：

```SQL
-- 左连结     
FROM <tb_1> LEFT  OUTER JOIN <tb_2> ON <condition(s)>
-- 右连结     
FROM <tb_1> RIGHT OUTER JOIN <tb_2> ON <condition(s)>
-- 全外连结
FROM <tb_1> FULL  OUTER JOIN <tb_2> ON <condition(s)>
```

#### 4.2.3 多表连结

```SQL
SELECT 表1.列, 表2.列, 表3.列
  FROM 表1
  JOIN 表2 ON 表1.关联字段 = 表2.关联字段
  JOIN 表3 ON 表2.关联字段 = 表3.关联字段
 WHERE 过滤条件;
```

#### 4.2.4 ON 子句进阶：非等值连结

我们之前用的 `JOIN ... ON A = B` 被称为等值连接（用等于号匹配）。

但 `ON` 子句其实非常灵活，它后面不仅可以写等于号，还可以写 `>`、`<`、`>=`、`<=`、`<>` 甚至 `BETWEEN`。这就叫非等值连接（Non-Equi Join）。

```SQL
SELECT p.product_name, 
       p.sale_price, 
       g.grade_name
  FROM product AS p
 INNER JOIN price_grade AS g 
    ON p.sale_price BETWEEN g.min_price AND g.max_price;
```

#### 4.2.5 交叉连结：CROSS JOIN（笛卡尔积）

如果说 `INNER JOIN` 是“按条件精确匹配”，`LEFT JOIN` 是“保留主表所有数据”，那么 `CROSS JOIN`（交叉连接）就是最原始、最暴力的“全排列组合”。

在 SQL 中，`CROSS JOIN` 不需要（也不能）写 `ON` 条件。它返回的结果是两张表行数的乘积，数学上称为笛卡尔积（Cartesian Product）。

```SQL
SELECT 列名
  FROM 表1
 CROSS JOIN 表2;
```

## 第五章 SQL 高级处理

### 5.1 窗口函数

#### 5.1.1 概念及基本用法

窗口函数也称为 OLAP（Online AnalyticalProcessing）函数，意思是对数据库数据进行实时分析处理

常规的SELECT语句都是对整张表进行查询，而窗口函数可以让我们有选择的去某一部分数据进行汇总、计算和排序。

通用格式是：

```SQL
<窗口函数> OVER ([ PARTITION BY <列名> ]
                     [ ORDER BY <排序用列名> ])  
```

- PARTITON BY 子句 可选参数，指示如何将查询行划分为组，类似于 GROUP BY 子句的分组功能，但是 PARTITION BY 子句并不具备 GROUP BY 子句的汇总功能，并不会改变原始表中记录的行数。

- ORDER BY 子句 可选参数，指示如何对每个分区中的行进行排序，即决定窗口内，是按哪种规则(字段)来排序的。

虽然 PARTITON BY 子句 和 ORDER BY 子句 都是可选参数，但是两个参数不能同时没有。

比如：

```SQL
SELECT product_name
       ,product_type
       ,sale_price
       ,RANK() OVER (PARTITION BY product_type
                       ORDER BY sale_price) AS ranking
  FROM product;  
```

得到的结果是：

![Image](assets/images/9b4ade198d/image-30.png)

在上述例子中，PRITITION BY 能够设定窗口对象范围，本例中指定了按照商品种类进行排序；ORDER BY 能够执行按照哪一列，何种顺序进行排序，默认是 ASC 升序。

![Image](assets/images/9b4ade198d/image-31.png)

### 5.2 窗口函数的种类

窗口函数可以分为两类：

- 将SUM、MAX、MIN等聚合函数用在窗口函数中

- RANK、DENSE_RANK等排序用的专用窗口函数

#### 5.2.1 专用窗口函数

- RANK函数：计算排序时，跳过相同位次的记录：1位、1位、1位、4位

- DENSE_RANK函数：计算排序，不跳：1位、1位、1位、2位

- ROW_NUMBER函数：赋予唯一的连续位次：1位、2位、3位、4位

```SQL
SELECT  product_name
       ,product_type
       ,sale_price
       ,RANK() OVER (ORDER BY sale_price) AS ranking
       ,DENSE_RANK() OVER (ORDER BY sale_price) AS dense_ranking
       ,ROW_NUMBER() OVER (ORDER BY sale_price) AS row_num
  FROM product;  
```

![Image](assets/images/9b4ade198d/image-32.png)

#### 5.2.2 聚合函数在窗口函数上的使用

聚合函数在窗口函数中的使用方法和之前的专用窗口函数一样，只是出来的结果是一个累计的聚合函数值。

```SQL
SELECT  product_id
       ,product_name
       ,sale_price
       ,SUM(sale_price) OVER (ORDER BY product_id) AS current_sum
       ,AVG(sale_price) OVER (ORDER BY product_id) AS current_avg  
  FROM product;  
```

![Image](assets/images/9b4ade198d/image-33.png)

![Image](assets/images/9b4ade198d/image-34.png)

### 5.3 窗口函数的应用：计算移动平均

聚合函数在窗口函数使用时，还可以指定更加详细的汇总范围，该汇总范围称为框架。

```SQL
<窗口函数> OVER (ORDER BY <排序用列名>
                 ROWS n PRECEDING )  -- 将框架指定为 截止到之前n行，加上自身行
                 
<窗口函数> OVER (ORDER BY <排序用列名>
                 ROWS BETWEEN n PRECEDING AND n FOLLOWING)
```

比如：

```SQL
SELECT  product_id
       ,product_name
       ,sale_price
       ,AVG(sale_price) OVER (ORDER BY product_id
                               ROWS 2 PRECEDING) AS moving_avg
  FROM product;  
```

截止到前两行再加上自己当前行，窗口长度为3行（如果有的话）

![Image](assets/images/9b4ade198d/image-35.png)

再比如：

```SQL
-- 截取前一行 + 后一行 + 自身行
SELECT  product_id
       ,product_name
       ,sale_price
       ,AVG(sale_price) OVER (ORDER BY product_id
                               ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS moving_avg  
  FROM product;  
```

![Image](assets/images/9b4ade198d/image-36.png)

### 5.4 GROUPING 运算符

常规的GROUP BY 只能得到每个分类的小计，有时候还需要计算分类的合计，可以用 ROLLUP关键字。

```SQL
SELECT  product_type
       ,regist_date
       ,SUM(sale_price) AS sum_price
  FROM product
 GROUP BY product_type, regist_date WITH ROLLUP;  
```

![Image](assets/images/9b4ade198d/image-37.png)

### 5.5 存储过程和函数

#### 5.5.1 基本介绍

```SQL
DELIMITER // -- 也可以使用 $$ 等其他特殊分隔符

CREATE
    [DEFINER = user]
    PROCEDURE sp_name ([proc_parameter[,...]])
    [characteristic ...]
BEGIN
  routine_body1;

  routine_body2;
END//

DELIMITER ;
```

- `CREATE PROCEDURE sp_name`：声明创建一个存储过程，`sp_name` 是你给这个过程起的名字（例如 `GetAveragePrice`）。

- `[DEFINER = user]`：（可选）指定这个存储过程是以谁的身份（哪个用户）来执行的。如果没有写，默认就是当前创建它的用户。常用于权限控制。

- `([proc_parameter[,...]])`：存储过程的参数列表。注意括号必须存在，即使没有参数也要写成 `()`。参数分为三种模式（IN、OUT、INOUT），后面详细说。

- `[characteristic ...]`：存储过程的特征说明（可选）。比如 `COMMENT '这是一个查数据的存储过程'`、`DETERMINISTIC`（表示输入同样的参数总是返回同样的结果）、`SQL SECURITY DEFINER` 等。

- `BEGIN ... END`：存储过程的主体（复合语句）。只要超过一条 SQL 语句，就必须用 `BEGIN` 和 `END` 包起来。`routine_body1` 和 `routine_body2` 之间用分号 `;` 隔开，代表一条独立的 SQL。



#### 5.5.2 参数介绍

格式为：`[IN | OUT | INOUT] 参数名 数据类型`。

- `IN`（默认）：输入参数。调用者把值传进去，存储过程内部使用这个值。在过程内部修改它，外部是看不到的。

- `OUT`：输出参数。调用者传一个变量进去（此时值为空），存储过程内部给它赋值，执行完毕后，调用者可以获取到这个返回的结果。

- `INOUT`：输入输出参数。调用者传值进去，存储过程可以读取它，也可以修改它，最后把修改后的值带回给外部。

比如：

```SQL
CREATE PROCEDURE GetCount(IN p_type VARCHAR(32), OUT p_count INT)
BEGIN
    SELECT COUNT(*) INTO p_count FROM product WHERE product_type = p_type;
END//
```

### 5.5 预处理声明 PREPARE Statement

通俗地讲，它就像是“填空题”的模板。你先给数据库发一个带 `?`（占位符）的 SQL 模板，数据库先把这个模板“编译”好。然后你每次只需要把具体的参数填进去，数据库直接执行即可。

这带来了两个巨大好处：

1. 防注入（安全）：参数被严格当成数据处理，不会破坏 SQL 结构，防止 SQL 注入攻击。

2. 提性能（速度）：如果同一个模板需要执行一万次，数据库只需要编译一次，省去了一万次编译的开销。

在 MySQL 中，完整的预处理包含三个步骤：`PREPARE`（准备） -> `EXECUTE`（执行） -> `DEALLOCATE`（释放）。

先 PREPARE 定义：

```SQL
-- stmt_name 是给预处理起的名字
PREPARE stmt_name FROM preparable_stmt;
```

然后 EXECUTE 执行：

```SQL
EXECUTE stmt_name [USING @var_name [, @var_name] ...];
```

最后 DEALLOCATE PREPARE 释放：

```SQL
DEALLOCATE PREPARE stmt_name;
```

### 5.6 课后习题

> 5.1 请说出针对本章中使用的 product（商品）表执行如下 SELECT 语句所能得到的结果。
> 
> SELECT  product_id
> 
> ,product_name
> 
> ,sale_price
> 
> ,MAX(sale_price) OVER (ORDER BY product_id) AS Current_max_price
> 
> FROM product;
> 
> 

按照 product_id 升序排列，计算出截止当前行的最高 sale_price



> 5.3 思考题
> 
> ① 窗口函数不指定PARTITION BY的效果是什么？
> 
> ② 为什么说窗口函数只能在SELECT子句中使用？实际上，在ORDER BY 子句使用系统并不会报错。
> 
> 

1. 窗口函数不指定 PARTITION BY 的效果是针对序列进行全局排序

2. 本质上是因为 `SQL` 语句的执行顺序。

**`FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY`****。如果在 ****`WHERE, GROUP BY, HAVING`**** 使用了窗口函数(属于SELECT 语句)，就是说提前进行了一次排序，排序之后再去除记录、汇总、汇总过滤，第一次排序结果就是错误的，没有实际意义。而 ****`ORDER BY`**** 语句执行顺序在 ****`SELECT`**** 语句之后，自然是可以使用的。**



