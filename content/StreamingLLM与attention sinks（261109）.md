# StreamingLLM与attention sinks（261109）

https://zhuanlan.zhihu.com/p/1990116555888035411

https://juejin.cn/post/7492987953251844134

https://www.high-flyer.cn/en/blog/streamingllm/

https://outcomeschool.com/blog/how-do-attention-sinks-work

https://huggingface.co/blog/tomaarsen/attention-sinks

---

### 引入

LLMs会因输入过长而流利度下降。当这种情况发生时，模型将失去生成语言的能力，开始生成例如无尽的换行、任意字符（`0OgOATO0OATO`）、破损的 Unicode（）或重复词。大多数 LLM 在输入长度超过预训练长度后才会出现这种行为。例如，[Llama 2 7B](https://huggingface.co/meta-llama/Llama-2-7b-hf) 在超过 4096 个令牌后会遇到这种情况，而 [Mistral-7B-v0.1](https://huggingface.co/mistralai/Mistral-7B-v0.1) 在约 10k 个令牌后会失去流利度。

假如我们正在构建一个聊天机器人，我们想和它对话好几个小时却不重启它，这会导致会话窗口越来越长，但是模型的上下文资源是有限的，不会让会话窗口一直长下去，这个上限叫做context window。简单理解，上下文窗口就是模型短期记忆的大小，当会话的长度大于了context window，为了不OOM导致崩溃，我们必须去除一些旧的tokens，为新tokens腾出空间，那么问题来了，我们应该摒弃哪些旧的tokens呢？

最直观的方法就是，维持一个滑动窗口（sliding window），把最老的的舍弃掉，让最新的进来：

```Python
Window holds 4 words. New words enter on the right.

Start:     [ Word1 Word2 Word3 Word4 ]
                ^
                first word

Word5 in:  Word1 dropped
           [ Word2 Word3 Word4 Word5 ]

Word6 in:  Word2 dropped
           [ Word3 Word4 Word5 Word6 ]

```

这个思路听起来很完美，但是当最老的几个词被丢弃后，模型立马就崩溃了——它的回答变成了胡说八道。

这是一个非常反直觉的现象，在我们看来，最老的那几个词不过是闲聊，并不是很重要而且和当前的话题毫无关系，但是为什么丢弃他们会让模型的生成质量一落千丈呢？

实际上这些开头的话在暗中起着重要的作用，这与attention sinks有关。

### 概念与定义

![Image](assets/images/005c2eef99/image-01.png)

在[Xiao et al., 2023](https://arxiv.org/abs/2309.17453)等人的论文中他们发现在前两层之后，几乎所有的attention都集中到了前几个token上，无论当前的单词是什么，文本的前几个词总是占据了大量注意力。模型将大量的注意力集中在前几个tokens上，这些tokens被称为attention sinks。

![Image](assets/images/005c2eef99/image-02.png)

我们从名字入手来拆解概念：attention sink = attention + sink。

> A sink is the drain in a kitchen where extra water flows away. An attention sink is the place where extra attention flows away. The first tokens act like a drain that soaks up the leftover focus.
> 
> 

因此我们可以把attention sink理解为注意力黑洞，它吸收（倾倒）掉了多余的注意力，成为了一个注意力汇聚区。

> In simple words, an attention sink is a token that the model uses as a dumping ground for attention it does not need anywhere else.
> 
> 

现在我们就可以理解为什么sliding window会失效了。当我们丢弃最前面的单词时，剩余的attention无处可去，所以整个系统崩溃了。

**紧接着的问题就是为什么第一个（前几个）token会成为attention sinks而不是其他位置的tokens？**

在计算attention scores时候，每个过去的单词都有一个分数，代表它对当前单词的重要性，所有的这些分数加起来必须是1。模型被迫把注意力分数分散到之前的每个单词上，这导致即使之前的tokne与生成的token匹配度不强，也能意外获得很高的注意力分数。但是很多时候当前的词不需要聚焦任何之前的词，它本身已经有足够的信息了，因此就有了剩余的注意力，这些注意力需要有一个安全的排水管

> It needs a token that it can dump extra attention onto without changing the meaning of anything.
> 
> 

它需要一个token，可以投入额外的注意力而不改变任何事物的意义。而第一个token是最安全的排水管道，因为文本中的每个词总是能看到第一个token（第一个token从一开始就存在）。

> When in doubt, dump the extra attention on the first token
> 
> 

所以模型习得了一个习惯，**拿不准时，就把多余的注意力分配给第一个 Token。**

### 实际案例

在论文中，作者提出了一种window attention的自适应方式，该窗口始终保持最初的4个token作为attention sinkl tokens留在窗口内：

![Image](assets/images/005c2eef99/image-03.png)

比如你和模型在聊一本10万字的小说，现在已经聊到了第50000个token，正常情况下当前token的绝对位置编码是50000，但是按照正常滑动窗口机制，缓存里只剩下：

```Python
[0, 1, 2, 3] （开头的 Sink）
[49996, 49997, 49998, 49999] （最近的词）
```

如果不做处理，模型看到的相对距离是 50000 - 3 =49997，这会导致模型极度困惑，因为它在训练的时候只见过几千长度的上下文，注意力计算（RoPE）会完全崩坏。

而StreamingLLM则不采用真实的绝地位置，在缓存内部重新分配位置。无论真实的文本有多长，缓存里只有八个坑位，那我们就给这 8 个坑位重新编号为 `0, 1, 2, 3, 4, 5, 6, 7`：

```Python
开头的 4 个 Sink 永远是位置 0, 1, 2, 3。
最近的 4 个词永远是位置 4, 5, 6, 7。
```

它们在位置编码上挨得非常近。在 RoPE（旋转位置编码）的机制下，距离近的 Token，它们之间的注意力计算更加稳定。模型可以很自然、很舒服地把多余的注意力权重“倾倒”给这几个位置永远是 0\~3 的 Sink Token 上。

让我们来结合具体的例子理解一下。

当前的上下文窗口中有四个词：

```Python
[ Word1 Word2 Word3 Word4 ]
```

假设我们正在处理word 4，模型必须将总和为1 的attention score分布在它能看到的单词上：

- 当前的word 4 真正关心的是 word 3，因此word 3 的attention score会很

- 给完 word 3很大的份额后，剩下的attenttion实际上并没啥必要

- 模型会把剩下的attention倾倒给 word 1，也就是attention sink上。

Attention score分布如下：

```Python
Word1 (the sink): 0.55
Word2:            0.02
Word3:            0.40
Word4 (current):  0.03
Total:            1.00
```

现在如果我们运行sliding window机制，word 1将会被丢弃，迫于attention score总和为1的规则，word 1 的0.55湖以北强制分散在剩余的单词上：

```Python
Word2: 0.10
Word3: 0.80
Word4: 0.10
Total: 1.00
```

我们发现 word 3 的score由原来的0.4被抬升到了0.8，同时 word 2 和 word 4 也被污染了，模型的焦点全错了，所以下一个输出变成了胡说八道。

> The drain is gone, and the dirty water spills everywhere
> 
> 

### 修复方法

当我们使用sliding window以节省内存时候，必须始终保留前几个sink tokens，再和后面滑动窗口的token进行拼接。

```Python
Full conversation：（context window = 5）
  Word1 Word2 Word3 ...  Word97 Word98 Word99 Word100
  ^^^^^                         
  sinks                         

Broken version (sinks dropped):
  [ Word96 Word97 Word98 Word99 Word100 ]
 

Fixed version (sinks kept):
  [ Word1 ] + [ Word97 Word98 Word99 Word100 ]
    keep        keep recent
    drain

```

在代码实现上：

```Python
def sliding_window(tokens, window_size):
    # keep only the most recent words
    return tokens[-window_size:]
```

```Python
def streaming_window(tokens, num_sinks, window_size):
    # always keep the first few sink tokens
    sinks = tokens[:num_sinks]
    # keep the most recent words
    recent = tokens[-window_size:]
    return sinks + recent
```

研究人员发现，仅保留前四个tokens作为sinks，通常足以保持模型稳定。

---

### StreamingLLM 

前面提到的keep the sink tokens 的概念是在一种叫做 StreamingLLM 的方法中引入的。

简单的讲，StreamingLLM是一种可以让模型无休止地输出而不会胡说八道的技术，具体的实现就是上部分代码提到的将sink tokens和最近的滑动窗口tokens拼接在一起。

这个技巧是一种token eviction，是KV Cache Compression技术的一种。通过这个技巧，模型可以在仅使用少量固定内存的情况下就处理数百万字的对话而不胡说八道和崩溃。

Deepseek-V4引入了**learnable attention sink**作为一个built-in的排水口，这样sink tokens 有了专门且干净的位置，不使用第一个真实词作为sink tokens，避免了和真实单词的混淆。

> This is how attention sinks moved from a surprising discovery to a planned feature.
> 
> 

这也就意味着一开始模型就可以被训练用来倾倒额外的注意力到learnable attention sink上，从而使得attention sinks 从一个反直觉的发现到计划中的特征。

![Image](assets/images/005c2eef99/image-04.png)

总的来讲attention sink 不仅仅可以用在 LLM 上，所有 attention-based 的模型都可以参考这一方式将输入序列的长度变得更加灵活。而对于其他 AI 研究领域来说，则是很好的将解释模型与研发模型结合的例子。











