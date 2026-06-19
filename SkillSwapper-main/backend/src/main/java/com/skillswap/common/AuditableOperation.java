package com.skillswap.common;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface AuditableOperation {

    String action();

    String resource();

    String resourceIdField() default "id";
}
